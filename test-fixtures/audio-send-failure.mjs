import { jest } from "@jest/globals";
import { createAudioTransmission } from "../src/audio/transmission.mjs";

export async function synchronousAudioSendFailureTest(expect) {
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
  await new Promise((resolve) => setImmediate(resolve));
  expect(onError).toHaveBeenCalledWith(new Error("socket send failed"));
  expect(stopStream).toHaveBeenCalledWith(1);
  now = 999;
  transmission.receive(Buffer.alloc(1280));
  expect(starts).toBe(1);
  now = 1000;
  transmission.receive(Buffer.alloc(1280));
  await new Promise((resolve) => setImmediate(resolve));
  expect(starts).toBe(2);
  await transmission.close();
}
