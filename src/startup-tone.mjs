import { createEncoder, encodeFloatFrame } from "./audio/encoder.mjs";
import { createToneFrame } from "./audio/tone-frame.mjs";

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
