import { expect, jest, test } from "@jest/globals";
import { closeRadioResources } from "../../src/radio/resources.mjs";

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
