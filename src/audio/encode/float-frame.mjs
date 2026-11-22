import { FRAME_BYTES, FRAME_SAMPLES } from "../codec.mjs";
import encodePcmFrame from "./pcm-frame.mjs";

export default function encodeFloatFrame(encoder, frame) {
  if (frame.length !== FRAME_BYTES) throw new Error("Audio frame must contain 20 ms of float PCM");
  const pcm = Buffer.alloc(FRAME_SAMPLES * 2);
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    const sample = frame.readFloatLE(i * 4);
    const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  return encodePcmFrame(encoder, pcm);
}
