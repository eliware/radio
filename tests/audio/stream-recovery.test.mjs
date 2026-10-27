import { jest, test, expect } from "@jest/globals";
import { createAudioStreamRecovery } from "../../src/audio/stream-recovery.mjs";
import { createAudioTransmission } from "../../src/audio/transmission.mjs";

test("backs off failed stream starts, caps the delay, and resets after success", () => {
  let now = 0;
  const onError = jest.fn();
  const recovery = createAudioStreamRecovery({ session: {}, onError, now: () => now });
  expect(recovery.canStart()).toBe(true);

  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    const error = new Error("start failed");
    recovery.failed(error);
    expect(onError).toHaveBeenLastCalledWith(error);
    expect(recovery.canStart()).toBe(false);
    now += delay;
    expect(recovery.canStart()).toBe(true);
  }

  recovery.started();
  recovery.failed(new Error("after reset"));
  expect(recovery.canStart()).toBe(false);
  now += 1000;
  expect(recovery.canStart()).toBe(true);
});

test("stops abandoned streams once the session is healthy", async () => {
  let healthy = false;
  const stopped = [];
  const session = { healthy: () => healthy, stopStream: async (id) => stopped.push(id) };
  const recovery = createAudioStreamRecovery({ session, onError: jest.fn(), now: () => 0 });
  const onComplete = jest.fn();
  recovery.abandon(3);
  recovery.abandon(4);
  expect(recovery.hasAbandoned).toBe(true);
  expect(recovery.stopAbandoned(onComplete)).toBeUndefined();
  expect(stopped).toEqual([]);

  healthy = true;
  await recovery.stopAbandoned(onComplete);
  expect(stopped).toEqual([3, 4]);
  expect(recovery.hasAbandoned).toBe(false);
  expect(recovery.isStopping).toBe(false);
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(recovery.stopAbandoned()).toBeUndefined();

  recovery.abandon(5);
  await recovery.stopAbandoned();
  expect(stopped).toEqual([3, 4, 5]);
});

test("shares concurrent abandoned cleanup and reports stop errors", async () => {
  let finishStop;
  const onError = jest.fn();
  const onComplete = jest.fn();
  const session = {
    healthy: () => true,
    stopStream: () => new Promise((resolve, reject) => (finishStop = { resolve, reject })),
  };
  const recovery = createAudioStreamRecovery({ session, onError, now: () => 0 });
  recovery.abandon(9);
  const stopping = recovery.stopAbandoned(onComplete);
  expect(recovery.isStopping).toBe(true);
  expect(recovery.stopAbandoned()).toBe(stopping);

  const error = new Error("stop failed");
  finishStop.reject(error);
  await stopping;
  expect(onError).toHaveBeenCalledWith(error);
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(recovery.isStopping).toBe(false);
});

test("abandons a stream after a synchronous audio send failure", async () => {
  let now = 0;
  let starts = 0;
  const onError = jest.fn();
  const stopStream = jest.fn(async () => {});
  const transmission = createAudioTransmission({
    rnnoise: {
      frameSize: 480,
      createDenoiseState: () => ({ processFrame: () => 0, destroy: () => {} }),
    },
    now: () => now,
    onError,
    session: {
      healthy: () => true,
      startStream: async () => ++starts,
      sendAudio: () => {
        throw new Error("socket send failed");
      },
      stopStream,
    },
    createProcessor: ({ onPacket }) => ({
      write: () => onPacket(Buffer.alloc(8)),
      finishTransmission: () => onPacket(Buffer.alloc(8)),
      close: () => {},
    }),
  });
  transmission.receive(Buffer.alloc(1280));
  for (let attempt = 0; attempt < 8; attempt += 1) await Promise.resolve();
  expect(onError).toHaveBeenCalledWith(new Error("socket send failed"));
  expect(stopStream).toHaveBeenCalledWith(1);
  now = 999;
  transmission.receive(Buffer.alloc(1280));
  expect(starts).toBe(1);
  now = 1000;
  transmission.receive(Buffer.alloc(1280));
  for (let attempt = 0; attempt < 8; attempt += 1) await Promise.resolve();
  expect(starts).toBe(2);
  await transmission.close();
});
