import { expect, jest, test } from "@jest/globals";
import { createTransmissionStart } from "../../../src/audio/transmission/start.mjs";

function dependencies(overrides = {}) {
  const recovery = {
    isStopping: false,
    hasAbandoned: false,
    canStart: () => true,
    started: jest.fn(),
    failed: jest.fn(),
    stopAbandoned: jest.fn(),
    stopOrAbandon: jest.fn(),
  };
  const buffer = { clear: jest.fn() };
  const finishTransmission = jest.fn();
  const options = {
    session: { healthy: () => true, startStream: jest.fn(async () => 7) },
    recovery,
    buffer,
    finishTransmission,
    isClosed: () => false,
    hasStream: () => false,
    onStarted: jest.fn(),
    onError: jest.fn(),
    ...overrides,
  };
  return { start: createTransmissionStart(options), ...options, processor: { finishTransmission } };
}

test("starts a stream and reports its id after startup completes", async () => {
  const state = dependencies();
  state.start.begin();
  expect(state.start.isStarting).toBe(true);
  await state.start.wait();
  expect(state.recovery.started).toHaveBeenCalledTimes(1);
  expect(state.onStarted).toHaveBeenCalledWith(7);
  expect(state.start.isStarting).toBe(false);
});

test("stops a stream that starts after shutdown", async () => {
  let closed = false;
  const recovery = dependencies({ isClosed: () => closed });
  recovery.start.begin();
  closed = true;
  await recovery.start.wait();
  expect(recovery.recovery.stopOrAbandon).toHaveBeenCalledWith(7);
  expect(recovery.onStarted).not.toHaveBeenCalled();
});

test("clears buffered audio and reports failed stream startup to recovery", async () => {
  const error = new Error("start failed");
  const state = dependencies({
    session: {
      healthy: () => true,
      startStream: async () => {
        throw error;
      },
    },
  });
  state.start.begin();
  await state.start.wait();
  expect(state.buffer.clear).toHaveBeenCalledTimes(1);
  expect(state.processor.finishTransmission).toHaveBeenCalledTimes(1);
  expect(state.recovery.failed).toHaveBeenCalledWith(error);
});

test("waits for an abandoned stream to stop before starting another", () => {
  const state = dependencies({ recovery: { ...dependencies().recovery, hasAbandoned: true } });
  state.start.begin();
  expect(state.recovery.stopAbandoned).toHaveBeenCalledTimes(1);
  expect(state.session.startStream).not.toHaveBeenCalled();
});
