export function createBroadcastifyRetry({
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  initialDelayMs = 1000,
  maxDelayMs = 300000,
} = {}) {
  let timer, stableTimer;
  let delay = initialDelayMs;
  return {
    schedule(callback) {
      if (timer !== undefined) return;
      timer = setTimeoutImpl(() => {
        timer = undefined;
        callback();
      }, delay);
      delay = Math.min(delay * 2, maxDelayMs);
    },
    reset() {
      delay = initialDelayMs;
    },
    resetAfterStable(durationMs) {
      if (stableTimer !== undefined) clearTimeoutImpl(stableTimer);
      stableTimer = setTimeoutImpl(() => {
        stableTimer = undefined;
        delay = initialDelayMs;
      }, durationMs);
    },
    cancelStableReset() {
      if (stableTimer === undefined) return;
      clearTimeoutImpl(stableTimer);
      stableTimer = undefined;
    },
    close() {
      if (timer !== undefined) clearTimeoutImpl(timer);
      timer = undefined;
      if (stableTimer !== undefined) clearTimeoutImpl(stableTimer);
      stableTimer = undefined;
    },
  };
}
