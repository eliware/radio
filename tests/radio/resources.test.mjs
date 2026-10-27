import { expect, jest, test } from "@jest/globals";
import { closeRadioResources } from "../../src/radio/resources.mjs";
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

function runtimeResources(makeInput, makeSessionSupervisor, makeAirbandSupervisor = () => ({})) {
  const closeBroadcastify = jest.fn(async () => {});
  const runtime = createRadioRuntime({
    configPaths: ["pd", "fd"],
    loadConfig: async (path) => (path === "pd" ? config("851", "PD") : config("853", "FD")),
    loadNoise: async () => ({ frameSize: 480 }),
    writeConfig: async () => {},
    chmodConfig: async () => {},
    log: quietLog,
    makeInput,
    makeSession: () => ({ healthy: () => true, close: async () => {} }),
    makeBroadcastify: () => ({
      close: closeBroadcastify,
      ready: () => true,
      status: () => ({ state: "running" }),
    }),
    makeSessionSupervisor,
    makeAirbandSupervisor,
  });
  return { runtime, closeBroadcastify };
}

test("settles all startup resources while preserving the startup error", async () => {
  const closeInputFailure = jest.fn(() => {
    throw new Error("input close failed");
  });
  const closeInput = jest.fn(async () => {});
  const closeBroadcastify = jest.fn(async () => {});
  const closeSessions = jest.fn(async () => {});
  await expect(
    closeRadioResources(
      {
        inputs: [{ close: closeInputFailure }, { close: closeInput }],
        broadcastify: { close: closeBroadcastify },
        sessions: { close: closeSessions },
      },
      { ignoreErrors: true },
    ),
  ).resolves.toBeUndefined();
  expect(closeInputFailure).toHaveBeenCalledTimes(1);
  expect(closeInput).toHaveBeenCalledTimes(1);
  expect(closeBroadcastify).toHaveBeenCalledTimes(1);
  expect(closeSessions).toHaveBeenCalledTimes(1);
});

test("closes every component before reporting a shutdown failure", async () => {
  const closeInput = jest.fn(async () => {
    throw new Error("first close failure");
  });
  const closeBroadcastify = jest.fn(async () => {});
  const closeSessions = jest.fn(async () => {
    throw new Error("second close failure");
  });
  const closeAirband = jest.fn(async () => {});
  await expect(
    closeRadioResources({
      inputs: [{ close: closeInput }],
      broadcastify: { close: closeBroadcastify },
      sessions: { close: closeSessions },
      airband: { close: closeAirband },
    }),
  ).rejects.toThrow("first close failure");
  expect(closeBroadcastify).toHaveBeenCalledTimes(1);
  expect(closeSessions).toHaveBeenCalledTimes(1);
  expect(closeAirband).toHaveBeenCalledTimes(1);
});

test("accepts an empty resource set", async () => {
  await expect(closeRadioResources({})).resolves.toBeUndefined();
});

test("closes all input listeners when one bind fails", async () => {
  let count = 0;
  const closeInput = jest.fn(async () => {});
  const { runtime, closeBroadcastify } = runtimeResources(
    () => ({
      listen: async () => {
        count += 1;
        if (count === 2) throw new Error("UDP port is busy");
      },
      close: closeInput,
    }),
    () => {
      throw new Error("supervisors must not start before listeners bind");
    },
  );
  await expect(runtime).rejects.toThrow("UDP port is busy");
  expect(closeInput).toHaveBeenCalledTimes(2);
  expect(closeBroadcastify).toHaveBeenCalledTimes(2);
});

test("closes constructed resources after supervisor startup failures", async () => {
  for (const failure of ["sessions", "airband"]) {
    const closeInput = jest.fn(async () => {});
    const closeSessions = jest.fn(async () => {});
    const { runtime, closeBroadcastify } = runtimeResources(
      () => ({ listen: async () => {}, close: closeInput }),
      () => {
        if (failure === "sessions") throw new Error("session setup failed");
        return { close: closeSessions };
      },
      () => {
        throw new Error("airband setup failed");
      },
    );
    await expect(runtime).rejects.toThrow(
      failure === "sessions" ? "session setup failed" : "airband setup failed",
    );
    expect(closeInput).toHaveBeenCalledTimes(2);
    expect(closeBroadcastify).toHaveBeenCalledTimes(2);
    expect(closeSessions).toHaveBeenCalledTimes(failure === "airband" ? 1 : 0);
  }
});
