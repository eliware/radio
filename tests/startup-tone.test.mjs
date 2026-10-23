import { expect, jest, test } from "@jest/globals";
import { createToneFrame, sendStartupTone } from "../src/startup-tone.mjs";
import { FRAME_SAMPLES, SAMPLE_RATE } from "../src/audio/codec.mjs";

test("creates the requested tone as float PCM", () => {
  const frame = createToneFrame(1000, 0);
  expect(frame.readFloatLE(0)).toBe(0);
  expect(frame.readFloatLE(4)).toBeCloseTo(0.25 * Math.sin((2 * Math.PI * 1000) / SAMPLE_RATE));
  expect(frame.length).toBe(FRAME_SAMPLES * 4);
});

test("uses the standard timer when no wait helper is supplied", async () => {
  jest.useFakeTimers();
  const sent = [];
  const session = {
    startStream: async () => 3,
    sendAudio: (_id, packet) => sent.push(packet),
    stopStream: async () => {},
  };
  const sending = sendStartupTone(session, 1000);
  await jest.advanceTimersByTimeAsync(1000);
  await sending;
  jest.useRealTimers();
  expect(sent).toHaveLength(50);
});

test("sends and stops a one-second, 20 ms packetized startup tone", async () => {
  const sent = [];
  const calls = [];
  const session = {
    startStream: async () => 17,
    sendAudio: (_id, data) => sent.push(data),
    stopStream: async (id) => calls.push(id),
  };
  await sendStartupTone(session, 1300, async (ms) => calls.push(ms));
  expect(sent).toHaveLength(50);
  expect(sent.every(Buffer.isBuffer)).toBe(true);
  expect(calls.filter((value) => value === 20)).toHaveLength(50);
  expect(calls.at(-1)).toBe(17);
});
