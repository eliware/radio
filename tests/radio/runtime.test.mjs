import { expect, jest, test } from "@jest/globals";
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
const silentLog = Object.fromEntries(
  ["debug", "info", "warn", "error"].map((level) => [level, () => {}]),
);

test("uses default runtime options before configuration validation", async () => {
  await expect(createRadioRuntime({ configPaths: [] })).rejects.toThrow(
    "At least one channel configuration file is required",
  );
  let configPath;
  await expect(
    createRadioRuntime({
      loadConfig: async (path) => {
        configPath = path;
        throw new Error("default config lookup");
      },
    }),
  ).rejects.toThrow("default config lookup");
  expect(configPath).toEqual(expect.any(String));
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

test("runs with one configured channel", async () => {
  const loadedConfig = config("851", "PD");
  const runtime = await createRadioRuntime({
    configPaths: ["pd"],
    loadConfig: async () => loadedConfig,
    loadNoise: async () => ({ frameSize: 480 }),
    writeConfig: async () => {},
    chmodConfig: async () => {},
    makeSession: () => ({ healthy: () => true, close: () => {} }),
    makeInput: () => ({ listen: async () => {}, close: async () => {} }),
    makeSessionSupervisor: () => ({ ready: () => true, status: () => ({}), close: async () => {} }),
    makeAirbandSupervisor: () => ({ ready: () => true, status: () => ({}), close: async () => {} }),
    log: silentLog,
  });
  expect(runtime.ready()).toBe(true);
  await runtime.close();
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

test("closes all input listeners when one bind fails", async () => {
  let count = 0;
  const closeInput = jest.fn(async () => {});
  const closeBroadcastify = jest.fn(async () => {});
  const runtime = createRadioRuntime({
    configPaths: ["pd", "fd"],
    loadConfig: async (path) => (path === "pd" ? config("851", "PD") : config("853", "FD")),
    loadNoise: async () => ({ frameSize: 480 }),
    writeConfig: async () => {},
    chmodConfig: async () => {},
    log: silentLog,
    makeInput: () => ({
      listen: async () => {
        count += 1;
        if (count === 2) throw new Error("UDP port is busy");
      },
      close: closeInput,
    }),
    makeSession: () => ({ healthy: () => true, close: async () => {} }),
    makeBroadcastify: () => ({ close: closeBroadcastify, ready: () => true, status: () => ({}) }),
    makeSessionSupervisor: () => {
      throw new Error("supervisors must not start before listeners bind");
    },
  });
  await expect(runtime).rejects.toThrow("UDP port is busy");
  expect(closeInput).toHaveBeenCalledTimes(2);
  expect(closeBroadcastify).toHaveBeenCalledTimes(2);
});

test("closes constructed resources after supervisor startup failures", async () => {
  for (const failure of ["sessions", "airband"]) {
    const closeInput = jest.fn(async () => {});
    const closeBroadcastify = jest.fn(async () => {});
    const closeSessions = jest.fn(async () => {});
    const runtime = createRadioRuntime({
      configPaths: ["pd", "fd"],
      loadConfig: async (path) => (path === "pd" ? config("851", "PD") : config("853", "FD")),
      loadNoise: async () => ({ frameSize: 480 }),
      writeConfig: async () => {},
      chmodConfig: async () => {},
      log: silentLog,
      makeInput: () => ({ listen: async () => {}, close: closeInput }),
      makeSession: () => ({ healthy: () => true, close: async () => {} }),
      makeBroadcastify: () => ({ close: closeBroadcastify, ready: () => true, status: () => ({}) }),
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
    expect(closeBroadcastify).toHaveBeenCalledTimes(2);
    expect(closeSessions).toHaveBeenCalledTimes(failure === "airband" ? 1 : 0);
  }
});
