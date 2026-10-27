import { FRAME_SAMPLES, SAMPLE_RATE } from "./codec.mjs";

export function createToneFrame(frequency, frameIndex) {
  const frame = Buffer.alloc(FRAME_SAMPLES * 4);
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    const sample =
      0.25 * Math.sin((2 * Math.PI * frequency * (frameIndex * FRAME_SAMPLES + i)) / SAMPLE_RATE);
    frame.writeFloatLE(sample, i * 4);
  }
  return frame;
}
