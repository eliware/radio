export function createAudioStreamRecovery({
  session,
  onError,
  now,
  maxRetryDelayMs = 30000,
  setTimeoutImpl,
  clearTimeoutImpl,
  isClosed = () => false,
  onAbandonedStopped = () => {},
}) {
  let retryAt = 0;
  let retryDelay = 1000;
  let abandonedIds = [];
  let stopping;
  let abandonedStopTimer;

  function scheduleAbandonedStop() {
    if (
      !setTimeoutImpl ||
      abandonedStopTimer !== undefined ||
      isClosed() ||
      abandonedIds.length === 0
    )
      return;
    abandonedStopTimer = setTimeoutImpl(() => {
      abandonedStopTimer = undefined;
      stopAbandoned();
    }, 1000);
  }

  function stopAbandoned(onComplete = onAbandonedStopped) {
    if (stopping || abandonedIds.length === 0) return stopping;
    if (!session.healthy()) {
      scheduleAbandonedStop();
      return stopping;
    }
    const ids = abandonedIds;
    abandonedIds = [];
    stopping = Promise.all(ids.map((id) => session.stopStream(id).catch(onError))).finally(() => {
      stopping = undefined;
      onComplete();
    });
    return stopping;
  }

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
    stopOrAbandon(id) {
      if (id !== undefined) abandonedIds.push(id);
      return stopAbandoned();
    },
    stopAbandoned,
    cancelAbandonedStop() {
      if (abandonedStopTimer === undefined) return;
      clearTimeoutImpl(abandonedStopTimer);
      abandonedStopTimer = undefined;
    },
  };
}
