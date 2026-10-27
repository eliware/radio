export function createAirbandRetry({ initialDelayMs = 1000, maxDelayMs = 30000 } = {}) {
  let delay = initialDelayMs;
  return {
    reset() {
      delay = initialDelayMs;
    },
    nextDelay() {
      const current = delay;
      delay = Math.min(delay * 2, maxDelayMs);
      return current;
    },
  };
}
