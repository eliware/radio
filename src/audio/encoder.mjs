import OpusScript from "opusscript";
import { FRAME_BYTES, FRAME_SAMPLES, SAMPLE_RATE } from "./codec.mjs";

export function createEncoder() {
  return new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.VOIP);
}

export function encodeFloatFrame(encoder, frame) {
  if (frame.length !== FRAME_BYTES) throw new Error("Audio frame must contain 20 ms of float PCM");
  const pcm = Buffer.alloc(FRAME_SAMPLES * 2);
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    const sample = frame.readFloatLE(i * 4);
    const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }
  return encodePcmFrame(encoder, pcm);
}

export function encodePcmFrame(encoder, pcm) {
  if (pcm.length !== FRAME_SAMPLES * 2)
    throw new Error("Audio frame must contain 20 ms of s16le PCM");
  return encoder.encode(pcm, FRAME_SAMPLES);
}
