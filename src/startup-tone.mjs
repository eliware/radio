import { FRAME_SAMPLES, SAMPLE_RATE } from "./audio/codec.mjs";
import { createEncoder, encodeFloatFrame } from "./audio/encoder.mjs";

export function createToneFrame(frequency, frameIndex) {
  const frame = Buffer.alloc(FRAME_SAMPLES * 4);
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    const sample =
      0.25 * Math.sin((2 * Math.PI * frequency * (frameIndex * FRAME_SAMPLES + i)) / SAMPLE_RATE);
    frame.writeFloatLE(sample, i * 4);
  }
  return frame;
}

export async function sendStartupTone(
  session,
  frequency,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const encoder = createEncoder();
  const streamId = await session.startStream();
  try {
    for (let frame = 0; frame < 50; frame += 1) {
      session.sendAudio(streamId, encodeFloatFrame(encoder, createToneFrame(frequency, frame)));
      await wait(20);
    }
  } finally {
    encoder.delete();
    await session.stopStream(streamId);
  }
}
