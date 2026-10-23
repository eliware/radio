import { Resampler } from "@eliware/resampler";
import { createEncoder, encodePcmFrame, SAMPLE_RATE } from "./codec.mjs";

const AIRBAND_RATE = 16000;
const OPUS_FRAME_BYTES = 960 * 2;

export function createNoisePipeline({ rnnoise, onPacket, onError = () => {} }) {
  const state = rnnoise.createDenoiseState();
  const encoder = createEncoder();
  const noiseFrameBytes = rnnoise.frameSize * 2;
  let resampler;
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
    const frame = Float32Array.from({ length: rnnoise.frameSize }, (_, i) =>
      pcm.readInt16LE(i * 2),
    );
    state.processFrame(frame);
    const output = Buffer.alloc(noiseFrameBytes);
    for (let i = 0; i < frame.length; i += 1) {
      output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(frame[i]))), i * 2);
    }
    encodedPcm = Buffer.concat([encodedPcm, output]);
    while (encodedPcm.length >= OPUS_FRAME_BYTES) sendFrame();
  }

  function sendFrame() {
    const frame = encodedPcm.subarray(0, OPUS_FRAME_BYTES);
    encodedPcm = encodedPcm.subarray(OPUS_FRAME_BYTES);
    onPacket(encodePcmFrame(encoder, frame));
  }

  function makeResampler() {
    const stream = new Resampler({ inRate: AIRBAND_RATE, outRate: SAMPLE_RATE });
    stream.on("data", consume);
    stream.on("error", onError);
    return stream;
  }

  resampler = makeResampler();
  return {
    write: (floatPcm) => {
      if (closed) throw new Error("Audio pipeline is closed");
      if (floatPcm.length % 4) throw new Error("Airband audio must contain float32 samples");
      const pcm = Buffer.alloc(floatPcm.length / 2);
      for (let i = 0; i < floatPcm.length / 4; i += 1) {
        const value = floatPcm.readFloatLE(i * 4);
        const clipped = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
        pcm.writeInt16LE(Math.round(clipped * 32767), i * 2);
      }
      resampler.write(pcm);
    },
    finishTransmission: () => {
      if (closed) return;
      resampler.destroy();
      resampled = Buffer.alloc(0);
      encodedPcm = Buffer.alloc(0);
      resampler = makeResampler();
    },
    close: () => {
      if (closed) return;
      closed = true;
      resampler.destroy();
      state.destroy();
      encoder.delete();
    },
  };
}
