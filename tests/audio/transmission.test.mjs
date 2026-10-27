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
  for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
  expect(jest.getTimerCount()).toBe(0);
  await transmission.close();
  transmission.receive(Buffer.alloc(1280));
  jest.useRealTimers();
  expect(sent).toEqual([]);
});

test("stops a stream that starts after shutdown begins", async () => {
  let finishStart;
  const stopStream = jest.fn(async () => {});
  const processor = { write: jest.fn(), finishTransmission: jest.fn(), close: jest.fn() };
  const transmission = createAudioTransmission({
    rnnoise,
    createProcessor: () => processor,
    session: {
      healthy: () => true,
      startStream: () => new Promise((resolve) => (finishStart = resolve)),
      sendAudio: () => {},
      stopStream,
    },
  });
  transmission.receive(Buffer.alloc(1280));
  const closing = transmission.close();
  finishStart(12);
  await closing;
  expect(stopStream).toHaveBeenCalledWith(12);
  expect(processor.write).not.toHaveBeenCalled();
});

test("stops an abandoned stream after the Zello session reconnects", async () => {
  let healthy = true;
  let now = 0;
  let idleCallback;
  let streamId = 0;
  const events = [];
  const transmission = createAudioTransmission({
    rnnoise,
    idleMs: 500,
    now: () => now,
    setTimeoutImpl: (callback) => ((idleCallback = callback), 1),
    clearTimeoutImpl: () => {},
    createProcessor: () => ({ write: () => {}, finishTransmission: () => {}, close: () => {} }),
    session: {
      healthy: () => healthy,
      startStream: async () => {
        streamId += 1;
        events.push(`start:${streamId}`);
        return streamId;
      },
      sendAudio: () => {},
      stopStream: async (id) => events.push(`stop:${id}`),
    },
  });
  transmission.receive(Buffer.alloc(1280));
  for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
  healthy = false;
  now = 600;
  idleCallback();
  for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
  healthy = true;
  transmission.receive(Buffer.alloc(1280));
  for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
  expect(events.slice(0, 3)).toEqual(["start:1", "stop:1", "start:2"]);
  await transmission.close();
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
  let idleCallback;
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
  await new Promise((resolve) => setImmediate(resolve));
  expect(processor.finishTransmission).toHaveBeenCalledTimes(1);
});
test("drops a partial PCM frame between idle transmissions", async () => {
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
  await new Promise((resolve) => setImmediate(resolve));
  idleCallback();
  await new Promise((resolve) => setImmediate(resolve));
  transmission.receive(Buffer.alloc(800));
  await new Promise((resolve) => setImmediate(resolve));
  now = 10;
  idleCallback();
  await new Promise((resolve) => setImmediate(resolve));
  transmission.receive(Buffer.alloc(960));
  await new Promise((resolve) => setImmediate(resolve));
  now = 20;
  idleCallback();
  await new Promise((resolve) => setImmediate(resolve));
  expect(processor.write).toHaveBeenCalledTimes(1);
  expect(processor.write.mock.calls[0][0]).toHaveLength(1280);
  expect(processor.finishTransmission).toHaveBeenCalledTimes(2);
  await transmission.close();
});
test("backs off failed Zello starts and discards stale audio", async () => {
  let now = 0;
  let startCount = 0;
  const onError = jest.fn();
  const processor = {
    write: jest.fn(),
    finishTransmission: jest.fn(),
    close: jest.fn(),
  };
  const transmission = createAudioTransmission({
    rnnoise,
    now: () => now,
    onError,
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {},
    createProcessor: () => processor,
    session: {
      healthy: () => true,
      startStream: async () => {
        startCount += 1;
        if (startCount < 3) throw new Error(`start failed ${startCount}`);
        return 5;
      },
      sendAudio: () => {},
      stopStream: async () => {},
    },
  });
  transmission.receive(Buffer.alloc(1280, 1));
  await new Promise((resolve) => setImmediate(resolve));
  expect(startCount).toBe(1);
  now = 999;
  transmission.receive(Buffer.alloc(1280, 2));
  expect(startCount).toBe(1);
  now = 1000;
  transmission.receive(Buffer.alloc(1280, 3));
  await new Promise((resolve) => setImmediate(resolve));
  expect(startCount).toBe(2);
  now = 2999;
  transmission.receive(Buffer.alloc(1280, 4));
  expect(startCount).toBe(2);
  now = 3000;
  transmission.receive(Buffer.alloc(1280, 5));
  await new Promise((resolve) => setImmediate(resolve));
  expect(startCount).toBe(3);
  expect(processor.write).toHaveBeenCalledTimes(1);
  expect(processor.write.mock.calls[0][0]).toEqual(Buffer.alloc(1280, 5));
  expect(processor.finishTransmission).toHaveBeenCalledTimes(2);
  expect(onError).toHaveBeenCalledTimes(2);
  await transmission.close();
});
