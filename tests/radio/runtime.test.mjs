import { expect, jest, test } from "@jest/globals";
import { getRuntimePaths } from "../../src/runtime-paths.mjs";
import { createRadioRuntime } from "../../src/radio/runtime.mjs";

const config = (serial, channel) => ({
  CHANNEL: channel,
  USERNAME: "user",
  PASSWORD: "pw",
  ISSUER: "issuer",
  PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
  SDR_SERIAL: serial,
  UDP_PORT: serial === "851" ? "15581" : "15422",
  FREQUENCY_MHZ: "155.1",
  CTCSS_HZ: "77.0",
  TONE: "1000",
});
const quietLog = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

test("builds one runtime from per-channel files and combines readiness", async () => {
  jest.useFakeTimers();
  let receiverReady = false;
  const events = [];
  const logs = [];
  const log = Object.fromEntries(
    ["debug", "info", "warn", "error"].map((level) => [
      level,
      (message, metadata) => logs.push({ level, message, metadata }),
    ]),
  );
  let capturedOptions;
  const loadedNoise = { frameSize: 480 };
  const runtime = await createRadioRuntime({
    configPaths: ["pd", "fd"],
    loadConfig: async (path) => (path === "pd" ? config("851", "PD") : config("853", "FD")),
    loadNoise: async () => loadedNoise,
    writeConfig: async (_path, text) => events.push(text),
    chmodConfig: async (_path, mode) => events.push(`mode:${mode}`),
    log,
    makeSession: () => ({ healthy: () => true, close: () => {} }),
    makeInput: (options) => {
      expect(options.rnnoise).toBe(loadedNoise);
      return { listen: async () => {}, close: async () => {} };
    },
    present: () => true,
    spawnProcess: () => {},
    makeSessionSupervisor: (_channels, options) => {
      capturedOptions = options;
      return {
        ready: () => true,
        status: () => ({ PD: { state: "online" }, FD: { state: "online" } }),
        close: async () => events.push("sessions closed"),
      };
    },
    makeAirbandSupervisor: (options) => {
      expect(options.present).toEqual(expect.any(Function));
      expect(options.spawnProcess).toBeDefined();
      return {
        ready: () => receiverReady,
        status: () => ({ state: receiverReady ? "running" : "waiting" }),
        close: async () => events.push("receiver closed"),
      };
    },
  });
  expect(runtime.ready()).toBe(false);
  expect(events).toContain("mode:384");
  receiverReady = true;
  expect(runtime.ready()).toBe(true);
  expect(events[0]).toContain("udp_stream");
  expect(runtime.status().channels.FD.state).toBe("online");
  capturedOptions.onError(new Error("sample"));
  const pause = capturedOptions.wait(0);
  await jest.advanceTimersByTimeAsync(0);
  await pause;
  expect(logs.at(-1)).toMatchObject({ level: "error", metadata: { error: { message: "sample" } } });
  await runtime.close();
  jest.useRealTimers();
  expect(events.slice(-2).sort()).toEqual(["receiver closed", "sessions closed"].sort());
});

test("applies standard settings without opening services when no channel files are configured", async () => {
  await expect(createRadioRuntime({ configPaths: [] })).rejects.toThrow("Two channels");
  const paths = [];
  await expect(
    createRadioRuntime({
      loadConfig: async (...args) => {
        paths.push(args);
        throw new Error("missing config");
      },
    }),
  ).rejects.toThrow("missing config");
  expect(paths).toEqual(getRuntimePaths({}).configPaths.map((path) => [path]));
});

test("closes every UDP input when any listener fails to bind", async () => {
  let count = 0;
  const close = jest.fn();
  const runtime = createRadioRuntime({
    configPaths: ["pd", "fd"],
    loadConfig: async (path) => (path === "pd" ? config("851", "PD") : config("853", "FD")),
    loadNoise: async () => ({ frameSize: 480 }),
    writeConfig: async () => {},
    chmodConfig: async () => {},
    log: quietLog,
    makeInput: () => {
      count += 1;
      return {
        listen: async () => {
          if (count === 2) throw new Error("UDP port is busy");
        },
        close,
      };
    },
    makeSessionSupervisor: () => {
      throw new Error("must not start sessions before listeners bind");
    },
  });
  await expect(runtime).rejects.toThrow("UDP port is busy");
  expect(close).toHaveBeenCalledTimes(2);
});

test("closes listeners and constructed supervisors after a startup failure", async () => {
  for (const failure of ["sessions", "airband"]) {
    const closeInput = jest.fn();
    const closeSessions = jest.fn();
    const runtime = createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => (path === "pd" ? config("851", "PD") : config("853", "FD")),
      loadNoise: async () => ({ frameSize: 480 }),
      writeConfig: async () => {},
      chmodConfig: async () => {},
      log: quietLog,
      makeInput: () => ({ listen: async () => {}, close: closeInput }),
      makeSessionSupervisor: () => {
        if (failure === "sessions") throw new Error("session setup failed");
        return { close: closeSessions };
      },
      makeAirbandSupervisor: () => {
        throw new Error("airband setup failed");
      },
    });
    await expect(runtime).rejects.toThrow(
      failure === "sessions" ? "session setup failed" : "airband setup failed",
    );
    expect(closeInput).toHaveBeenCalledTimes(2);
    expect(closeSessions).toHaveBeenCalledTimes(failure === "airband" ? 1 : 0);
  }
});

test("waits for every component to close when one shutdown rejects", async () => {
  let inputCount = 0;
  const closeSessions = jest.fn();
  const closeAirband = jest.fn();
  const closeInput = jest.fn(async () => {
    inputCount += 1;
    if (inputCount === 1) throw new Error("input close failed");
  });
  const runtime = await createRadioRuntime({
    configPaths: ["pd", "fd"],
    loadConfig: async (path) => (path === "pd" ? config("851", "PD") : config("853", "FD")),
    loadNoise: async () => ({ frameSize: 480 }),
    writeConfig: async () => {},
    chmodConfig: async () => {},
    log: quietLog,
    makeInput: () => ({ listen: async () => {}, close: closeInput }),
    makeSessionSupervisor: () => ({ ready: () => true, status: () => ({}), close: closeSessions }),
    makeAirbandSupervisor: () => ({
      ready: () => true,
      status: () => ({}),
      close: closeAirband,
    }),
  });
  await expect(runtime.close()).rejects.toThrow("input close failed");
  expect(closeInput).toHaveBeenCalledTimes(2);
  expect(closeSessions).toHaveBeenCalledTimes(1);
  expect(closeAirband).toHaveBeenCalledTimes(1);
});
