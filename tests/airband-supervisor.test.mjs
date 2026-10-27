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

test("retries USB detection errors with backoff", async () => {
  let releaseWait;
  let attempts = 0;
  const children = [];
  const errors = [];
  const supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: (ms) => new Promise((resolve) => ((releaseWait = resolve), errors.push(`wait:${ms}`))),
    onError: (error) => errors.push(error.message),
    log: quietLog,
    present: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("USB scan failed");
      return true;
    },
    spawnProcess: () => {
      const child = new Child();
      children.push(child);
      return child;
    },
  });
  for (let attempt = 0; attempt < 20 && !releaseWait; attempt += 1) await Promise.resolve();
  expect(supervisor.status()).toMatchObject({ state: "error", error: "USB scan failed" });
  expect(errors).toContain("USB scan failed");
  releaseWait();
  for (let attempt = 0; attempt < 20 && !supervisor.ready(); attempt += 1) await Promise.resolve();
  expect(attempts).toBe(2);
  expect(supervisor.ready()).toBe(true);
  children[0].emit("close", 1, null);
  for (
    let attempt = 0;
    attempt < 20 && errors.filter((entry) => entry.startsWith("wait:")).length < 2;
    attempt += 1
  )
    await Promise.resolve();
  expect(errors.filter((entry) => entry.startsWith("wait:"))).toEqual(["wait:1000", "wait:1000"]);
  await supervisor.close();
});

test("waits for missing devices and stops polling on close", async () => {
  let releaseWait;
  const waits = [];
  const supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: (ms) => {
      waits.push(ms);
      return new Promise((resolve) => (releaseWait = resolve));
    },
    onError: () => {},
    log: quietLog,
    present: async () => false,
    spawnProcess: () => new Child(),
  });
  for (let attempt = 0; attempt < 20 && !releaseWait; attempt += 1) await Promise.resolve();
  expect(waits).toEqual([2000]);
  expect(supervisor.status().state).toBe("waiting-for-sdrs");
  await supervisor.close();
});

test("does not spawn when shutdown follows device detection", async () => {
  let supervisor;
  let closing;
  const spawnProcess = jest.fn();
  supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: async () => {},
    onError: () => {},
    log: quietLog,
    spawnProcess,
    waitForDevices: async () => {
      queueMicrotask(() => {
        closing = supervisor.close();
      });
      return true;
    },
  });
  for (let attempt = 0; attempt < 20 && !closing; attempt += 1) await Promise.resolve();
  await closing;
  expect(spawnProcess).not.toHaveBeenCalled();
  expect(supervisor.status().state).toBe("stopped");
});

test("uses built-in defaults while waiting for an unknown SDR", async () => {
  const supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "serial-that-is-not-connected" }],
    configPath: "/tmp/unused.conf",
    wait: async () => {},
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

test("reports child process errors and waits for restart", async () => {
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
  child.emit("close", null, "SIGTERM");
  for (let attempt = 0; attempt < 20 && !releaseWait; attempt += 1) await Promise.resolve();
  expect(errors).toContain("process event error");
  expect(child.listenerCount("close")).toBe(0);
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
      queueMicrotask(() => {
        child.emit("error", new Error("spawn event failed"));
        child.emit("close", null, "SIGTERM");
      });
      return child;
    },
  });
  for (let attempt = 0; attempt < 20 && failed.status().state !== "error"; attempt += 1)
    await Promise.resolve();
  expect(failed.status()).toMatchObject({ state: "error", error: "spawn event failed" });
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

test("force kills Airband after an error when no close event arrives", async () => {
  let child;
  let forceKill;
  const supervisor = createAirbandSupervisor({
    configs: [{ SDR_SERIAL: "851" }],
    configPath: "/tmp/airband.conf",
    wait: async () => {},
    onError: () => {},
    log: quietLog,
    present: async () => true,
    spawnProcess: () => (child = new EventEmitter()),
    shutdownTimeoutMs: 10,
    setTimeoutImpl: (callback) => ((forceKill = callback), 1),
    clearTimeoutImpl: jest.fn(),
  });
  for (let attempt = 0; attempt < 20 && !child; attempt += 1) await Promise.resolve();
  child.kill = jest.fn((signal) => {
    if (signal === "SIGKILL") child.emit("close", null, signal);
  });
  child.emit("error", new Error("process failed"));
  const closing = supervisor.close();
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  forceKill();
  await closing;
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  expect(supervisor.status().state).toBe("stopped");
});
