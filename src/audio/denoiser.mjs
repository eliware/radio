export function createAudioDenoiser({ rnnoise, rnnoiseMix = 1, onPcm, onError = () => {} }) {
  let state = rnnoise.createDenoiseState();
  const frameBytes = rnnoise.frameSize * 2;
  const buffered = Buffer.alloc(frameBytes);
  let bufferedBytes = 0;
  let closed = false;

  function processFrame() {
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
        let offset = 0;
        while (offset < chunk.length) {
          const copied = Math.min(frameBytes - bufferedBytes, chunk.length - offset);
          chunk.copy(buffered, bufferedBytes, offset, offset + copied);
          bufferedBytes += copied;
          offset += copied;
          if (bufferedBytes === frameBytes) {
            processFrame();
            bufferedBytes = 0;
          }
        }
      } catch (error) {
        bufferedBytes = 0;
        let resetError;
        try {
          state.destroy();
        } catch (cause) {
          resetError = cause;
        }
        try {
          state = rnnoise.createDenoiseState();
        } catch (cause) {
          resetError ??= cause;
        }
        if (resetError) {
          onError(resetError);
        }
        onError(error);
      }
    },
    reset() {
      if (!closed) bufferedBytes = 0;
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        state.destroy();
      } catch (error) {
        onError(error);
        throw error;
      }
    },
  };
}
