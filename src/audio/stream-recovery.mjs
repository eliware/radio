export function createAudioStreamRecovery({ session, onError, now, maxRetryDelayMs = 30000 }) {
  let retryAt = 0;
  let retryDelay = 1000;
  let abandonedIds = [];
  let stopping;

  return {
    canStart: () => now() >= retryAt,
    get hasAbandoned() {
      return abandonedIds.length > 0;
    },
    get isStopping() {
      return Boolean(stopping);
    },
    started() {
      retryAt = 0;
      retryDelay = 1000;
    },
    failed(error) {
      retryAt = now() + retryDelay;
      retryDelay = Math.min(retryDelay * 2, maxRetryDelayMs);
      onError(error);
    },
    abandon(id) {
      abandonedIds.push(id);
    },
    stopAbandoned(onComplete = () => {}) {
      if (stopping || !session.healthy() || abandonedIds.length === 0) return stopping;
      const ids = abandonedIds;
      abandonedIds = [];
      stopping = Promise.all(ids.map((id) => session.stopStream(id).catch(onError))).finally(() => {
        stopping = undefined;
        onComplete();
      });
      return stopping;
    },
  };
}
