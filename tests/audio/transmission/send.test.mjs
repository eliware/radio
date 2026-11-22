import { expect, jest, test } from "@jest/globals";
import createTransmissionSend from "../../../src/audio/transmission/send.mjs";

function setup({ healthy = true, streamId = 4, write = jest.fn() } = {}) {
  const recovery = {
    abandon: jest.fn(),
    failed: jest.fn(),
    stopAbandoned: jest.fn(),
  };
  const buffer = {
    clear: jest.fn(),
    flush: jest.fn((sendFrame) => sendFrame(Buffer.alloc(1280))),
  };
  const idle = { reset: jest.fn() };
  const processor = {
    write,
    finishTransmission: jest.fn(),
    close: jest.fn(),
  };
  const onError = jest.fn();
  let currentStreamId = streamId;
  const sender = createTransmissionSend({
    session: { healthy: () => healthy, sendAudio: jest.fn() },
    rnnoise: {},
    rnnoiseMix: 1,
    createProcessor: () => processor,
    recovery,
    buffer,
    idle,
    getStreamId: () => currentStreamId,
    setStreamId: (id) => {
      currentStreamId = id;
    },
    onError,
  });
  return { sender, recovery, buffer, idle, processor, onError };
}

test("flushes PCM frames through the audio processor and supports close", () => {
  const state = setup();
  state.sender.flush();
  expect(state.processor.write).toHaveBeenCalledWith(Buffer.alloc(1280));
  state.sender.finishTransmission();
  state.sender.close();
  expect(state.processor.finishTransmission).toHaveBeenCalledTimes(1);
  expect(state.processor.close).toHaveBeenCalledTimes(1);
});

test("drops queued audio and abandons an active stream when Zello disconnects", () => {
  const state = setup({ healthy: false });
  state.sender.flush();
  expect(state.recovery.abandon).toHaveBeenCalledWith(4);
  expect(state.buffer.clear).toHaveBeenCalledTimes(1);
  expect(state.idle.reset).toHaveBeenCalledTimes(1);
  expect(state.processor.finishTransmission).toHaveBeenCalledTimes(1);
});

test("does not process frames without a stream and reports processor failures", () => {
  const state = setup({ streamId: null });
  state.sender.flush();
  expect(state.buffer.flush).not.toHaveBeenCalled();

  const error = new Error("processor failed");
  const failed = setup({
    write: () => {
      throw error;
    },
  });
  failed.sender.flush();
  expect(failed.onError).toHaveBeenCalledWith(error);
});
