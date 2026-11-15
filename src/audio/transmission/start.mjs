export function createTransmissionStart({
  session,
  recovery,
  buffer,
  processor,
  isClosed,
  hasStream,
  onStarted,
  onError,
}) {
  let starting;

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
        buffer.clear();
        processor.finishTransmission();
        recovery.failed(error);
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
  };
}
