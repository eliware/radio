export default function recoverDenoiserState(state, setState, rnnoise, onError, error) {
  let resetError;
  try {
    state.destroy();
  } catch (cause) {
    resetError = cause;
  }
  try {
    setState(rnnoise.createDenoiseState());
  } catch (cause) {
    resetError ??= cause;
  }
  if (resetError) onError(resetError);
  onError(error);
}
