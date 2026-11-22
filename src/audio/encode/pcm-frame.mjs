import { FRAME_SAMPLES } from "../codec.mjs";

export default function encodePcmFrame(encoder, pcm) {
  if (pcm.length !== FRAME_SAMPLES * 2)
    throw new Error("Audio frame must contain 20 ms of s16le PCM");
  return encoder.encode(pcm, FRAME_SAMPLES);
}
