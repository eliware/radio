export default function createBroadcastifyStability({
  onStable,
  setTimeoutImpl,
  clearTimeoutImpl,
}) {
  let timer;
  return {
    observe(durationMs) {
      if (timer !== undefined) clearTimeoutImpl(timer);
      timer = setTimeoutImpl(() => {
        timer = undefined;
        onStable();
      }, durationMs);
    },
    cancel() {
      if (timer === undefined) return;
      clearTimeoutImpl(timer);
      timer = undefined;
    },
    close() {
      if (timer !== undefined) clearTimeoutImpl(timer);
      timer = undefined;
    },
  };
}
