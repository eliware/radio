import { expect, jest, test } from "@jest/globals";
import { createAudioTransmission } from "../../src/audio/transmission.mjs";

const rnnoise = {
  frameSize: 480,
  createDenoiseState: () => ({ processFrame: () => 0, destroy: () => {} }),
};

test("streams gated audio once and stops after silence", async () => {
  jest.useFakeTimers();
  const sent = [];
  const events = [];
  const transmission = createAudioTransmission({
    session: {
      healthy: () => true,
      startStream: async () => {
        events.push("start");
        return 4;
      },
      sendAudio: (id, packet) => sent.push([id, packet]),
      stopStream: async (id) => events.push(`stop:${id}`),
    },
    rnnoise,
    idleMs: 30,
  });
  for (let i = 0; i < 4; i += 1) transmission.receive(Buffer.alloc(1280));
  await jest.advanceTimersByTimeAsync(30);
  await transmission.close();
  jest.useRealTimers();
  expect(events).toEqual(["start", "stop:4"]);
  expect(sent.length).toBeGreaterThan(0);
  expect(sent[0][0]).toBe(4);
});

test("drops buffered audio if the session disconnects during stream startup", async () => {
  jest.useFakeTimers();
  let healthy = true;
  let finishStart;
  const sent = [];
  const transmission = createAudioTransmission({
    rnnoise,
    session: {
      healthy: () => healthy,
      startStream: () => new Promise((resolve) => (finishStart = resolve)),
      sendAudio: (...args) => sent.push(args),
      stopStream: async () => {},
    },
  });
  transmission.receive(Buffer.alloc(1280));
  transmission.receive(Buffer.alloc(1280));
  healthy = false;
  finishStart(4);
  await transmission.close();
  transmission.receive(Buffer.alloc(1280));
  jest.useRealTimers();
  expect(sent).toEqual([]);
});

test("reports processor write failures", async () => {
  const onError = jest.fn();
  const transmission = createAudioTransmission({
    rnnoise,
    onError,
    session: { healthy: () => true, startStream: async () => 8, stopStream: async () => {} },
    createProcessor: () => ({
      write: () => {
        throw new Error("processor failed");
      },
      finishTransmission: () => {},
      close: () => {},
    }),
  });
  transmission.receive(Buffer.alloc(1280));
  await new Promise((resolve) => setImmediate(resolve));
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "processor failed" }));
  await transmission.close();
});

test("keeps one stream open when new audio arrives during startup", async () => {
  jest.useFakeTimers();
  let now = 0;
  let finishStart;
  const starts = jest.fn(() => new Promise((resolve) => (finishStart = resolve)));
  const transmission = createAudioTransmission({
    rnnoise,
    idleMs: 30,
    now: () => now,
    session: { healthy: () => true, startStream: starts, stopStream: async () => {} },
  });
  transmission.receive(Buffer.alloc(1280));
  now = 30;
  jest.advanceTimersByTime(30);
  transmission.receive(Buffer.alloc(1280));
  finishStart(4);
  for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
  await jest.advanceTimersByTimeAsync(1);
  now = 60;
  await transmission.close();
  jest.useRealTimers();
  expect(starts).toHaveBeenCalledTimes(1);
});

test("ignores audio after close and tolerates close without a healthy session", async () => {
  const processor = {
    write: jest.fn(),
    finishTransmission: jest.fn(),
    close: jest.fn(),
  };
  const transmission = createAudioTransmission({
    rnnoise,
    session: { healthy: () => false },
    createProcessor: () => processor,
  });
  await transmission.close();
  transmission.receive(Buffer.alloc(1280));
  await transmission.close();
  expect(processor.close).toHaveBeenCalledTimes(1);
});

test("closes an active stream even when shutdown happens before the idle timeout", async () => {
  const processor = {
    write: jest.fn(),
    finishTransmission: jest.fn(),
    close: jest.fn(),
  };
  const stopStream = jest.fn(async () => {});
  const transmission = createAudioTransmission({
    rnnoise,
    idleMs: 500,
    now: () => 1000,
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
});

test("does not end a transmission before the idle interval expires", async () => {
  let idleCallback;
  const transmission = createAudioTransmission({
    rnnoise,
    idleMs: 500,
    now: () => 10,
    setTimeoutImpl: (callback) => ((idleCallback = callback), 1),
    clearTimeoutImpl: () => {},
    session: { healthy: () => true, startStream: async () => 3, stopStream: async () => {} },
  });
  transmission.receive(Buffer.alloc(1280));
  idleCallback();
  await new Promise((resolve) => setImmediate(resolve));
  await transmission.close();
});
