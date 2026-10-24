import { expect, jest, test } from "@jest/globals";
import { createBroadcastifyRuntime } from "../../src/broadcastify/runtime.mjs";

test("starts one stream per config, reports readiness and status, and closes all outputs", async () => {
  const outputs = [
    { ready: () => true, status: () => ({ state: "running" }), close: jest.fn() },
    { ready: () => false, status: () => ({ state: "disabled" }), close: jest.fn() },
  ];
  const makeStream = jest.fn(() => outputs.shift());
  const runtime = createBroadcastifyRuntime([{ CHANNEL: "PD" }, { CHANNEL: "FD" }], makeStream);
  expect(makeStream).toHaveBeenCalledTimes(2);
  expect(runtime.ready()).toBe(false);
  expect(runtime.status([{ name: "PD" }, { name: "FD" }])).toEqual({
    PD: { state: "running" },
    FD: { state: "disabled" },
  });
  await runtime.close();
  expect(makeStream.mock.results.map(({ value }) => value.close)).toHaveLength(2);
});

test("uses default stream factory and error handler", () => {
  const runtime = createBroadcastifyRuntime([{ BROADCASTIFY_ENABLED: "false" }]);
  expect(runtime.ready()).toBe(true);
  expect(runtime.status([{ name: "Off" }]).Off.state).toBe("disabled");
});

test("provides a default error handler to output factories", () => {
  const runtime = createBroadcastifyRuntime(
    [{ BROADCASTIFY_ENABLED: "false" }],
    (_settings, { onError }) => {
      expect(() => onError(new Error("sample"))).not.toThrow();
      return { ready: () => true, status: () => ({ state: "off" }), close: async () => {} };
    },
  );
  expect(runtime.ready()).toBe(true);
});
