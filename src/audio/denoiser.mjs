export function createAudioDenoiser({ rnnoise, rnnoiseMix = 1, onPcm, onError = () => {} }) {
  const state = rnnoise.createDenoiseState();
  const frameBytes = rnnoise.frameSize * 2;
  let buffered = Buffer.alloc(0);
  let closed = false;

  function processFrame() {
    const pcm = buffered.subarray(0, frameBytes);
    buffered = buffered.subarray(frameBytes);
    const original = Float32Array.from({ length: rnnoise.frameSize }, (_, i) =>
      pcm.readInt16LE(i * 2),
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
        buffered = Buffer.concat([buffered, chunk]);
        while (buffered.length >= frameBytes) processFrame();
      } catch (error) {
        onError(error);
      }
    },
    reset() {
      if (!closed) buffered = Buffer.alloc(0);
    },
    close() {
      if (closed) return;
      closed = true;
      state.destroy();
    },
  };
}
