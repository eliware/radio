export function createBroadcastifyRetry({
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  initialDelayMs = 1000,
  maxDelayMs = 300000,
} = {}) {
  let timer;
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
    close() {
      if (timer !== undefined) clearTimeoutImpl(timer);
      timer = undefined;
    },
  };
}
