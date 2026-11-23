import recoverDenoiserState from "./recovery.mjs";

export default function createDenoiserState({ rnnoise, onError }) {
  let state = rnnoise.createDenoiseState();

  return {
    processFrame(frame) {
      state.processFrame(frame);
    },
    recover(error) {
      recoverDenoiserState(state, (next) => (state = next), rnnoise, onError, error);
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
