import { createPcmFrameBuffer } from "./denoiser/buffer.mjs";
import { createDenoiserFrameProcessor } from "./denoiser/frame-processor.mjs";
import { createDenoiserState } from "./denoiser/state.mjs";

export function createAudioDenoiser({ rnnoise, rnnoiseMix = 1, onPcm, onError = () => {} }) {
  const state = createDenoiserState({ rnnoise, onError });
  const buffer = createPcmFrameBuffer(rnnoise.frameSize * 2);
  let closed = false;
  const processFrame = createDenoiserFrameProcessor({
    frameSize: rnnoise.frameSize,
    processFrame: (frame) => state.processFrame(frame),
    rnnoiseMix,
    onPcm,
  });

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
