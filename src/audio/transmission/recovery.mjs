export default function createAudioStreamRecovery({
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
  let pendingStopComplete;

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
      return stopAbandoned(pendingStopComplete);
    }, 1000);
  }

  function stopAbandoned(onComplete = onAbandonedStopped) {
    if (stopping || abandonedIds.length === 0) return stopping;
    const complete = onComplete;
    pendingStopComplete = complete;
    if (!session.healthy()) {
      scheduleAbandonedStop();
      return stopping;
    }
    const ids = abandonedIds;
    abandonedIds = [];
    let shouldComplete = false;
    stopping = Promise.all(
      ids.map(async (id) => {
        try {
          await session.stopStream(id);
          return undefined;
        } catch (error) {
          onError(error);
          return id;
        }
      }),
    )
      .then((remainingIds) => {
        abandonedIds = [...remainingIds.filter((id) => id !== undefined), ...abandonedIds];
        if (abandonedIds.length > 0) scheduleAbandonedStop();
        else shouldComplete = true;
      })
      .finally(() => {
        stopping = undefined;
        if (shouldComplete) {
          pendingStopComplete = undefined;
          complete();
        }
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
      const delay = retryDelay;
      retryAt = now() + delay;
      retryDelay = Math.min(retryDelay * 2, maxRetryDelayMs);
      onError(error);
      return delay;
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
