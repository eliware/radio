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
  const runtime = createBroadcastifyRuntime(
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

test("uses the default disabled stream and reports readiness", () => {
  const runtime = createBroadcastifyRuntime([{ BROADCASTIFY_ENABLED: "false" }]);
  expect(runtime.ready()).toBe(true);
  expect(runtime.status([{ name: "Off" }]).Off.state).toBe("disabled");
});

test("provides a default error handler to stream and supervisor factories", () => {
  const createSupervisor = (_settings, { onError }) => ({
    child: undefined,
    ready: () => true,
    status: () => ({ state: "off" }),
    close: async () => {},
    report: () => onError(new Error("sample")),
  });
  const runtime = createBroadcastifyRuntime(
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

test("closes a supervisor when stream construction throws", async () => {
  const close = jest.fn(async () => {});
  expect(() =>
    createBroadcastifyRuntime(
      [{ BROADCASTIFY_ENABLED: "false" }],
      () => {
        throw new Error("stream factory failed");
      },
      undefined,
      () => ({ child: undefined, ready: () => false, status: () => ({}), close }),
    ),
  ).toThrow("stream factory failed");
  await Promise.resolve();
  expect(close).toHaveBeenCalledTimes(1);
});

test("closes completed outputs when a later stream factory throws", async () => {
  let streamCalls = 0;
  const closeStream = jest.fn();
  const closeSupervisor = jest.fn(async () => {});
  const createSupervisor = () => ({
    child: undefined,
    ready: () => true,
    status: () => ({ state: "disabled" }),
    close: closeSupervisor,
  });
  expect(() =>
    createBroadcastifyRuntime(
      [{ CHANNEL: "PD" }, { CHANNEL: "FD" }],
      () => {
        streamCalls += 1;
        if (streamCalls === 2) throw new Error("later stream failed");
        return { write: () => {}, close: closeStream };
      },
      undefined,
      createSupervisor,
    ),
  ).toThrow("later stream failed");
  await Promise.resolve();
  expect(closeStream).toHaveBeenCalledTimes(1);
  expect(closeSupervisor).toHaveBeenCalledTimes(2);
});
