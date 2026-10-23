import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createAirbandSupervisor } from "../src/airband-supervisor.mjs";

const quietLog = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

class Child extends EventEmitter {
  constructor() {
    super();
    queueMicrotask(() => this.emit("spawn"));
  }
  kill() {
    this.emit("close", 0, null);
  }
}

test("reports ready only while one Airband process is running", async () => {
  jest.useFakeTimers();
  const calls = [];
  const supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }, { SDR_SERIAL: "853" }],
    configPath: "/tmp/airband.conf",
    wait: async () => {},
    onError: () => {},
    log: quietLog,
    present: async (serial) => {
      calls.push(serial);
      return true;
    },
    spawnProcess: (command, args) => {
      calls.push(command, ...args);
      return new Child();
    },
  });
  for (let attempt = 0; attempt < 20 && !supervisor.ready(); attempt += 1) {
    await jest.advanceTimersByTimeAsync(0);
  }
  expect(supervisor.ready()).toBe(true);
  expect(calls).toContain("rtl_airband");
  expect(supervisor.status().state).toBe("running");
  await supervisor.close();
  jest.useRealTimers();
  expect(supervisor.ready()).toBe(false);
});

test("backs off after process exits and handles spawn failures", async () => {
  let releaseWait;
  let isPresent = true;
  let child;
  const errors = [];
  const waits = [];
  const supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: (ms) => {
      waits.push(ms);
      return new Promise((resolve) => (releaseWait = resolve));
    },
    onError: (error) => errors.push(error.message),
    log: quietLog,
    present: async () => isPresent,
    spawnProcess: () => (child = new Child()),
  });
  for (let attempt = 0; attempt < 20 && !supervisor.ready(); attempt += 1) await Promise.resolve();
  child.emit("close", null, "SIGTERM");
  for (let attempt = 0; attempt < 20 && !releaseWait; attempt += 1) await Promise.resolve();
  expect(errors[0]).toContain("SIGTERM");
  expect(waits).toEqual([1000]);
  isPresent = false;
  releaseWait();
  for (
    let attempt = 0;
    attempt < 20 && supervisor.status().state !== "waiting-for-sdrs";
    attempt += 1
  )
    await Promise.resolve();
  expect(supervisor.status().state).toBe("waiting-for-sdrs");
  await supervisor.close();

  const retry = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: async () => {},
    onError: (error) => errors.push(error.message),
    log: quietLog,
    present: async () => true,
    spawnProcess: () => {
      throw new Error("spawn failed");
    },
  });
  for (let attempt = 0; attempt < 20 && retry.status().state !== "error"; attempt += 1)
    await Promise.resolve();
  expect(retry.status().error).toBe("spawn failed");
  await retry.close();
});

test("evaluates built-in process defaults without starting hardware", async () => {
  const supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "serial-that-is-not-connected" }],
    configPath: "/tmp/unused.conf",
    wait: () => new Promise(() => {}),
    onError: () => {},
  });
  for (
    let attempt = 0;
    attempt < 20 && supervisor.status().state !== "waiting-for-sdrs";
    attempt += 1
  )
    await Promise.resolve();
  await supervisor.close();
  expect(supervisor.status().state).toBe("stopped");
});

test("waits for missing hardware and reports child process errors", async () => {
  const delays = [];
  const waiting = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/unused.conf",
    wait: async (ms) => delays.push(ms),
    onError: () => {},
    log: quietLog,
    present: async () => false,
    spawnProcess: () => new Child(),
  });
  for (let attempt = 0; attempt < 20 && !delays.length; attempt += 1) await Promise.resolve();
  expect(waiting.status().state).toBe("waiting-for-sdrs");
  expect(delays).toEqual([2000]);
  await waiting.close();

  let releaseWait;
  let child;
  const errors = [];
  const failed = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: () => new Promise((resolve) => (releaseWait = resolve)),
    onError: (error) => errors.push(error.message),
    log: quietLog,
    present: async () => true,
    spawnProcess: () => (child = new Child()),
  });
  for (let attempt = 0; attempt < 20 && !failed.ready(); attempt += 1) await Promise.resolve();
  child.emit("error", new Error("process event error"));
  expect(failed.status().state).toBe("error");
  expect(releaseWait).toBeUndefined();
  child.emit("close", null, "SIGTERM");
  for (let attempt = 0; attempt < 20 && !releaseWait; attempt += 1) await Promise.resolve();
  expect(errors).toContain("process event error");
  releaseWait();
  await failed.close();
});

test("reports a pre-spawn child error as an error state", async () => {
  let releaseWait;
  let child;
  const failed = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: () => new Promise((resolve) => (releaseWait = resolve)),
    onError: () => {},
    log: quietLog,
    present: async () => true,
    spawnProcess: () => {
      child = new EventEmitter();
      queueMicrotask(() => child.emit("error", new Error("spawn event failed")));
      return child;
    },
  });
  for (let attempt = 0; attempt < 20 && failed.status().state !== "error"; attempt += 1)
    await Promise.resolve();
  expect(failed.status()).toMatchObject({ state: "error", error: "spawn event failed" });
  expect(child.listenerCount("close")).toBe(1);
  expect(releaseWait).toBeUndefined();
  child.emit("close", null, null);
  for (let attempt = 0; attempt < 20 && !releaseWait; attempt += 1) await Promise.resolve();
  expect(child.listenerCount("close")).toBe(0);
  releaseWait();
  await failed.close();
});

test("stops before retrying when an error callback shuts down the supervisor", async () => {
  let failed;
  let stopped;
  failed = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: async () => {},
    onError: () => {
      stopped = failed.close();
    },
    log: quietLog,
    present: async () => true,
    spawnProcess: () => {
      throw new Error("shutdown now");
    },
  });
  for (let attempt = 0; attempt < 20 && !stopped; attempt += 1) await Promise.resolve();
  await stopped;
  expect(failed.status().state).toBe("stopped");
});
