import { expect, test } from "@jest/globals";
import createToneFrame from "../../../src/audio/tone/frame.mjs";
import createStartupToneFrames from "../../../src/audio/tone/startup-frames.mjs";
import { FRAME_SAMPLES, SAMPLE_RATE } from "../../../src/audio/codec.mjs";

test("creates the requested tone as 48 kHz float PCM", () => {
  const frame = createToneFrame(1000, 0);
  expect(frame.readFloatLE(0)).toBe(0);
  expect(frame.readFloatLE(4)).toBeCloseTo(0.25 * Math.sin((2 * Math.PI * 1000) / SAMPLE_RATE));
  expect(frame.length).toBe(FRAME_SAMPLES * 4);
});

test("generates 50 audio frames for a one-second startup tone", () => {
  const frames = [...createStartupToneFrames(1000)];
  expect(frames).toHaveLength(50);
  expect(frames.every((frame) => frame.length === FRAME_SAMPLES * 4)).toBe(true);
});
