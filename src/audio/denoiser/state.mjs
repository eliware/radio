export default function createDenoiserState({ rnnoise, onError }) {
  let state = rnnoise.createDenoiseState();

  return {
    processFrame(frame) {
      state.processFrame(frame);
    },
    recover(error) {
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
      if (resetError) onError(resetError);
      onError(error);
    },
    close() {
      try {
        state.destroy();
      } catch (error) {
        onError(error);
        throw error;
      }
    },
  };
}
