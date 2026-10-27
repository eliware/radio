import { expect, jest, test } from "@jest/globals";
import { getRuntimePaths } from "../../src/runtime-paths.mjs";
import { knownSecrets } from "../../src/logging/secrets.mjs";
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
test("builds one runtime from channel files and combines component readiness", async () => {
  jest.useFakeTimers();
  let receiverReady = false;
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
    writeConfig: async () => {},
    chmodConfig: async () => {},
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
        close: async () => {},
      };
    },
    makeAirbandSupervisor: (options) => {
      expect(options.present).toEqual(expect.any(Function));
      expect(options.spawnProcess).toBeDefined();
      return {
        ready: () => receiverReady,
        status: () => ({ state: receiverReady ? "running" : "waiting" }),
        close: async () => {},
      };
    },
  });
  expect(runtime.ready()).toBe(false);
  receiverReady = true;
  expect(runtime.ready()).toBe(true);
  expect(runtime.status().channels.FD.state).toBe("online");
  capturedOptions.onError(new Error("sample"));
  const pause = capturedOptions.wait(0);
  await jest.advanceTimersByTimeAsync(0);
  await pause;
  expect(logs.at(-1)).toMatchObject({ level: "error", metadata: { error: { message: "sample" } } });
  await runtime.close();
  jest.useRealTimers();
});

test("rejects incomplete channel configuration before starting services", async () => {
  await expect(createRadioRuntime({ configPaths: [] })).rejects.toThrow(
    "Exactly two channel configuration files are required",
  );
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

test("requires exactly two configured channels", async () => {
  const loadConfig = jest.fn(async () => config("851", "PD"));
  await expect(createRadioRuntime({ configPaths: ["pd"], loadConfig })).rejects.toThrow(
    "Exactly two channel configuration files are required",
  );
  expect(loadConfig).not.toHaveBeenCalled();
});

test("rejects duplicate receiver serials and UDP ports before startup", async () => {
  const settings = [config("851", "PD"), config("851", "FD")];
  const loadNoise = jest.fn(async () => ({ frameSize: 480 }));
  await expect(
    createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => settings[path === "pd" ? 0 : 1],
      loadNoise,
    }),
  ).rejects.toThrow("Two channels need distinct SDR serials");
  expect(loadNoise).not.toHaveBeenCalled();
  settings[1] = { ...settings[1], SDR_SERIAL: "853", UDP_PORT: settings[0].UDP_PORT };
  await expect(
    createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => settings[path === "pd" ? 0 : 1],
      loadNoise,
    }),
  ).rejects.toThrow("Two channels need distinct UDP ports");
  expect(loadNoise).not.toHaveBeenCalled();
});

test("releases secrets when a UDP listener fails to bind", async () => {
  const settings = [config("851", "PD"), config("853", "FD")];
  const inputClose = jest.fn();
  await expect(
    createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => settings[path === "pd" ? 0 : 1],
      loadNoise: async () => ({ frameSize: 480 }),
      writeConfig: async () => {},
      chmodConfig: async () => {},
      makeInput: () => ({
        listen: async () => {
          throw new Error("bind failed");
        },
        close: inputClose,
      }),
      makeBroadcastify: () => ({
        write: () => {},
        ready: () => true,
        status: () => ({ state: "disabled" }),
        close: async () => {},
      }),
    }),
  ).rejects.toThrow("bind failed");
  expect(inputClose).toHaveBeenCalledTimes(2);
  expect(knownSecrets).not.toContain(settings[0].PASSWORD);
});

test("closes resources and releases secrets if supervisor startup fails", async () => {
  const settings = [config("851", "PD"), config("853", "FD")];
  const closeInput = jest.fn();
  await expect(
    createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => settings[path === "pd" ? 0 : 1],
      loadNoise: async () => ({ frameSize: 480 }),
      writeConfig: async () => {},
      chmodConfig: async () => {},
      log: { info: () => {} },
      makeInput: () => ({ listen: async () => {}, close: closeInput }),
      makeBroadcastify: () => ({
        write: () => {},
        ready: () => true,
        status: () => ({ state: "disabled" }),
        close: async () => {},
      }),
      makeSessionSupervisor: () => {
        throw new Error("supervisor startup failed");
      },
    }),
  ).rejects.toThrow("supervisor startup failed");
  expect(closeInput).toHaveBeenCalledTimes(2);
  expect(knownSecrets).not.toContain(settings[0].PASSWORD);
});

test("closes Broadcastify streams and releases credentials if input creation throws", async () => {
  const closeBroadcast = jest.fn(async () => {});
  const settings = [config("851", "PD"), config("853", "FD")];
  await expect(
    createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => settings[path === "pd" ? 0 : 1],
      loadNoise: async () => ({ frameSize: 480 }),
      writeConfig: async () => {},
      chmodConfig: async () => {},
      makeBroadcastify: () => ({
        write: () => {},
        ready: () => true,
        status: () => ({ state: "running" }),
        close: closeBroadcast,
      }),
      makeInput: () => {
        throw new Error("input construction failed");
      },
    }),
  ).rejects.toThrow("input construction failed");
  expect(closeBroadcast).toHaveBeenCalledTimes(2);
});

test("redacts credential-bearing configuration write failures", async () => {
  const settings = [config("851", "PD"), config("853", "FD")];
  await expect(
    createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => settings[path === "pd" ? 0 : 1],
      loadNoise: async () => ({ frameSize: 480 }),
      writeConfig: async () => {
        throw new Error(`write failed ${settings[0].PASSWORD}`);
      },
    }),
  ).rejects.toThrow("write failed [REDACTED]");
  expect(knownSecrets).not.toContain(settings[0].PASSWORD);
});
