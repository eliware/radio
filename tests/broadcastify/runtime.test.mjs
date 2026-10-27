import { expect, jest, test } from "@jest/globals";
import { createBroadcastifyRuntime } from "../../src/broadcastify/runtime.mjs";

test("coordinates stream creation, supervisor readiness, status, and shutdown", async () => {
  const child = { id: 1 };
  const supervisors = [
    {
      child,
      ready: () => true,
      status: () => ({ state: "running" }),
      close: jest.fn(async () => {}),
    },
    {
      child: undefined,
      ready: () => false,
      status: () => ({ state: "connecting" }),
      close: jest.fn(async () => {}),
    },
  ];
  const streamClose = jest.fn();
  const createSupervisor = jest.fn(() => supervisors.shift());
  const createStream = jest.fn((_settings, { getChild }) => {
    if (createStream.mock.calls.length === 1) expect(getChild()).toBe(child);
    return { write: jest.fn(), close: streamClose };
  });
  const runtime = await createBroadcastifyRuntime(
    [{ CHANNEL: "PD" }, { CHANNEL: "FD" }],
    createStream,
    undefined,
    createSupervisor,
  );

  expect(createSupervisor).toHaveBeenCalledTimes(2);
  expect(createStream).toHaveBeenCalledTimes(2);
  expect(runtime.ready()).toBe(false);
  expect(runtime.status([{ name: "PD" }, { name: "FD" }])).toEqual({
    PD: { state: "running" },
    FD: { state: "connecting" },
  });
  await runtime.close();
  expect(streamClose).toHaveBeenCalledTimes(2);
  expect(supervisors).toHaveLength(0);
  expect(createSupervisor.mock.results.map(({ value }) => value.close)).toHaveLength(2);
});

test("uses the default disabled stream and reports readiness", async () => {
  const runtime = await createBroadcastifyRuntime([{ BROADCASTIFY_ENABLED: "false" }]);
  expect(runtime.ready()).toBe(true);
  expect(runtime.status([{ name: "Off" }]).Off.state).toBe("disabled");
});

test("reports status by channel name when configs are sparse or reordered", async () => {
  const supervisors = [
    { ready: () => true, status: () => ({ state: "fire" }), close: async () => {} },
  ];
  const runtime = await createBroadcastifyRuntime(
    [{ CHANNEL: "Fire", BROADCASTIFY_ENABLED: "false" }],
    () => ({ write: () => {}, close: async () => {} }),
    undefined,
    () => supervisors.shift(),
  );
  expect(runtime.status([{ name: "Police" }, { name: "Fire" }])).toEqual({
    Police: { state: "disabled" },
    Fire: { state: "fire" },
  });
});

test("provides a default error handler to stream and supervisor factories", async () => {
  const createSupervisor = (_settings, { onError }) => ({
    child: undefined,
    ready: () => true,
    status: () => ({ state: "off" }),
    close: async () => {},
    report: () => onError(new Error("sample")),
  });
  const runtime = await createBroadcastifyRuntime(
    [{ BROADCASTIFY_ENABLED: "false" }],
    (_settings, { onError }) => {
      expect(() => onError(new Error("sample"))).not.toThrow();
      return { write: () => {}, close: async () => {} };
    },
    undefined,
    createSupervisor,
  );
  expect(runtime.ready()).toBe(true);
});

test("awaits supervisor cleanup when stream construction throws", async () => {
  const close = jest.fn(async () => {});
  await expect(
    createBroadcastifyRuntime(
      [{ BROADCASTIFY_ENABLED: "false" }],
      () => {
        throw new Error("stream factory failed");
      },
      undefined,
      () => ({ child: undefined, ready: () => false, status: () => ({}), close }),
    ),
  ).rejects.toThrow("stream factory failed");
  expect(close).toHaveBeenCalledTimes(1);
});

test("awaits cleanup of completed outputs when a later stream factory throws", async () => {
  let streamCalls = 0;
  let releaseStreamClose;
  const streamFinished = new Promise((resolve) => (releaseStreamClose = resolve));
  const closeStream = jest.fn(() => streamFinished);
  let releaseClose;
  const closeFinished = new Promise((resolve) => (releaseClose = resolve));
  const closeSupervisor = jest.fn(() => closeFinished);
  const createSupervisor = () => ({
    child: undefined,
    ready: () => true,
    status: () => ({ state: "disabled" }),
    close: closeSupervisor,
  });
  const startup = createBroadcastifyRuntime(
    [{ CHANNEL: "PD" }, { CHANNEL: "FD" }],
    () => {
      streamCalls += 1;
      if (streamCalls === 2) throw new Error("later stream failed");
      return { write: () => {}, close: closeStream };
    },
    undefined,
    createSupervisor,
  );
  let settled = false;
  const rejection = expect(startup)
    .rejects.toThrow("later stream failed")
    .finally(() => {
      settled = true;
    });
  await Promise.resolve();
  expect(closeStream).not.toHaveBeenCalled();
  expect(closeSupervisor).toHaveBeenCalledTimes(1);
  expect(settled).toBe(false);
  releaseClose();
  for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
  expect(closeStream).toHaveBeenCalledTimes(1);
  expect(settled).toBe(false);
  releaseStreamClose();
  await rejection;
  expect(closeStream).toHaveBeenCalledTimes(1);
  expect(closeSupervisor).toHaveBeenCalledTimes(2);
});
