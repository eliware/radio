export default function createTransmissionEnd({
  isClosed,
  isIdle,
  isStarting,
  waitForStart,
  buffer,
  sender,
  getStreamId,
  setStreamId,
  recovery,
}) {
  return async function end(force) {
    if ((isClosed() && !force) || !isIdle(force)) return;
    if (isStarting()) await waitForStart();
    if (!isIdle(force)) return;
    buffer.keepCompleteFrames();
    sender.flush();
    buffer.clear();
    sender.finishTransmission();
    const id = getStreamId();
    setStreamId(undefined);
    await recovery.stopOrAbandon(id);
  };
}
