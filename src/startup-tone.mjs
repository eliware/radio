import createEncoder from "./audio/encoder.mjs";
import encodeFloatFrame from "./audio/encode/float-frame.mjs";
import createStartupToneFrames from "./audio/tone/startup-frames.mjs";

export default async function sendStartupTone(
  session,
  frequency,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const encoder = createEncoder();
  const streamId = await session.startStream();
  try {
    for (const frame of createStartupToneFrames(frequency)) {
      session.sendAudio(streamId, encodeFloatFrame(encoder, frame));
      await wait(20);
    }
  } finally {
    encoder.delete();
    await session.stopStream(streamId);
  }
}
