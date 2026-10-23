import OpusScript from "opusscript";

export const SAMPLE_RATE = 16000;
export const FRAME_SAMPLES = 320;
export const FRAME_BYTES = FRAME_SAMPLES * 4;

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
  return encoder.encode(pcm, FRAME_SAMPLES);
}

export function codecHeader() {
  const header = Buffer.alloc(4);
  header.writeUInt16LE(SAMPLE_RATE);
  header.writeUInt8(1, 2);
  header.writeUInt8(20, 3);
  return header.toString("base64");
}
