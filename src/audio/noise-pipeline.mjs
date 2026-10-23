import { createEncoder, encodePcmFrame } from "./codec.mjs";
import { createAudioResampler } from "./resampler.mjs";

const OPUS_FRAME_BYTES = 960 * 2;

export function createNoisePipeline({ rnnoise, rnnoiseMix = 1, onPacket, onError = () => {} }) {
  const state = rnnoise.createDenoiseState();
  const encoder = createEncoder();
  const noiseFrameBytes = rnnoise.frameSize * 2;
  let resampled = Buffer.alloc(0);
  let encodedPcm = Buffer.alloc(0);
  let closed = false;

  function consume(chunk) {
    try {
      resampled = Buffer.concat([resampled, chunk]);
      while (resampled.length >= noiseFrameBytes) processFrame();
    } catch (error) {
      onError(error);
    }
  }

  function processFrame() {
    const pcm = resampled.subarray(0, noiseFrameBytes);
    resampled = resampled.subarray(noiseFrameBytes);
    const original = Float32Array.from({ length: rnnoise.frameSize }, (_, i) =>
      pcm.readInt16LE(i * 2),
    );
    const frame = Float32Array.from(original);
    state.processFrame(frame);
    const output = Buffer.alloc(noiseFrameBytes);
    for (let i = 0; i < frame.length; i += 1) {
      const mixed = frame[i] * rnnoiseMix + original[i] * (1 - rnnoiseMix);
      output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mixed))), i * 2);
    }
    encodedPcm = Buffer.concat([encodedPcm, output]);
    while (encodedPcm.length >= OPUS_FRAME_BYTES) sendFrame();
  }

  function sendFrame() {
    const frame = encodedPcm.subarray(0, OPUS_FRAME_BYTES);
    encodedPcm = encodedPcm.subarray(OPUS_FRAME_BYTES);
    onPacket(encodePcmFrame(encoder, frame));
  }

  const resampler = createAudioResampler({ onPcm: consume, onError });
  return {
    write: (floatPcm) => {
      if (closed) throw new Error("Audio pipeline is closed");
      resampler.write(floatPcm);
    },
    finishTransmission: () => {
      if (closed) return;
      resampled = Buffer.alloc(0);
      encodedPcm = Buffer.alloc(0);
      resampler.reset();
    },
    close: () => {
      if (closed) return;
      closed = true;
      resampler.close();
      state.destroy();
      encoder.delete();
    },
  };
}
