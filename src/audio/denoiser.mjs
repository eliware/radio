import { createPcmFrameBuffer } from "./denoiser/buffer.mjs";
import { createDenoiserState } from "./denoiser/state.mjs";

export function createAudioDenoiser({ rnnoise, rnnoiseMix = 1, onPcm, onError = () => {} }) {
  const state = createDenoiserState({ rnnoise, onError });
  const frameBytes = rnnoise.frameSize * 2;
  const buffer = createPcmFrameBuffer(frameBytes);
  let closed = false;

  function processFrame(buffered) {
    const original = Float32Array.from({ length: rnnoise.frameSize }, (_, i) =>
      buffered.readInt16LE(i * 2),
    );
    const frame = Float32Array.from(original);
    state.processFrame(frame);
    const output = Buffer.alloc(frameBytes);
    for (let i = 0; i < frame.length; i += 1) {
      const mixed = frame[i] * rnnoiseMix + original[i] * (1 - rnnoiseMix);
      output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mixed))), i * 2);
    }
    onPcm(output);
  }

  return {
    write(chunk) {
      if (closed) throw new Error("Audio denoiser is closed");
      try {
        buffer.write(chunk, processFrame);
      } catch (error) {
        buffer.reset();
        state.recover(error);
      }
    },
    reset() {
      if (!closed) buffer.reset();
    },
    close() {
      if (closed) return;
      closed = true;
      state.close();
    },
  };
}
