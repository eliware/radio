import { expect, jest, test } from "@jest/globals";
import createAudioTransmission from "../../../src/audio/transmission.mjs";

const rnnoise = {
  frameSize: 480,
  createDenoiseState: () => ({ processFrame: () => 0, destroy: () => {} }),
};

async function flushMicrotasks() {
  for (let attempt = 0; attempt < 8; attempt += 1) await Promise.resolve();
}

test("closes an active stream when shutdown precedes the idle timeout", async () => {
  let idleCallback;
  const processor = { write: jest.fn(), finishTransmission: jest.fn(), close: jest.fn() };
  const stopStream = jest.fn(async () => {});
  const transmission = createAudioTransmission({
    rnnoise,
    idleMs: 500,
    now: () => 1000,
    setTimeoutImpl: (callback) => ((idleCallback = callback), 1),
    clearTimeoutImpl: () => {},
    session: {
      healthy: () => true,
      startStream: async () => 9,
      sendAudio: () => {},
      stopStream,
    },
    createProcessor: () => processor,
  });
  transmission.receive(Buffer.alloc(1280));
  await transmission.close();
  expect(stopStream).toHaveBeenCalledWith(9);
  expect(processor.finishTransmission).toHaveBeenCalled();
  expect(processor.close).toHaveBeenCalledTimes(1);
  idleCallback();
  await flushMicrotasks();
  expect(processor.finishTransmission).toHaveBeenCalledTimes(1);
});

test("keeps complete PCM frames and drops partial audio between transmissions", async () => {
  let now = 0;
  let idleCallback;
  const processor = { write: jest.fn(), finishTransmission: jest.fn(), close: jest.fn() };
  const transmission = createAudioTransmission({
    rnnoise,
    idleMs: 10,
    now: () => now,
    setTimeoutImpl: (callback) => ((idleCallback = callback), 1),
    clearTimeoutImpl: () => {},
    createProcessor: () => processor,
    session: { healthy: () => true, startStream: async () => 3, stopStream: async () => {} },
  });
  transmission.receive(Buffer.alloc(800));
  await flushMicrotasks();
  idleCallback();
  await flushMicrotasks();
  transmission.receive(Buffer.alloc(800));
  await flushMicrotasks();
  now = 10;
  idleCallback();
  await flushMicrotasks();
  transmission.receive(Buffer.alloc(960));
  await flushMicrotasks();
  now = 20;
  idleCallback();
  await flushMicrotasks();
  expect(processor.write).toHaveBeenCalledTimes(1);
  expect(processor.write.mock.calls[0][0]).toHaveLength(1280);
  expect(processor.finishTransmission).toHaveBeenCalledTimes(2);
  await transmission.close();
});
