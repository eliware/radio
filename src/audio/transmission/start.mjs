export function createTransmissionStart({
  session,
  recovery,
  finishTransmission,
  isClosed,
  hasStream,
  onStarted,
  onError,
  setTimeoutImpl,
  clearTimeoutImpl,
}) {
  let starting;
  let retryTimer;

  function begin() {
    if (
      isClosed() ||
      hasStream() ||
      starting ||
      recovery.isStopping ||
      !session.healthy() ||
      !recovery.canStart()
    )
      return;
    if (recovery.hasAbandoned) {
      recovery.stopAbandoned()?.catch(onError);
      return;
    }
    starting = session
      .startStream()
      .then((id) => {
        recovery.started();
        if (isClosed()) return recovery.stopOrAbandon(id);
        onStarted(id);
      })
      .catch((error) => {
        finishTransmission();
        const retryDelay = recovery.failed(error);
        if (retryTimer === undefined) {
          retryTimer = setTimeoutImpl(() => {
            retryTimer = undefined;
            begin();
          }, retryDelay);
        }
      })
      .finally(() => {
        starting = undefined;
      });
  }

  return {
    begin,
    get isStarting() {
      return Boolean(starting);
    },
    wait: () => starting,
    close() {
      if (retryTimer === undefined) return;
      clearTimeoutImpl(retryTimer);
      retryTimer = undefined;
    },
  };
}
