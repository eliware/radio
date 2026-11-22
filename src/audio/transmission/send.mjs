import createTransmissionSendRecovery from "./send-recovery.mjs";

export default function createTransmissionSend({
  session,
  rnnoise,
  rnnoiseMix,
  onProcessedPcm,
  createProcessor,
  buffer,
  recovery,
  idle,
  getStreamId,
  setStreamId,
  onError,
}) {
  let processor;
  const sendRecovery = createTransmissionSendRecovery({
    session,
    recovery,
    buffer,
    finishTransmission: () => processor.finishTransmission(),
    onAbandon: () => setStreamId(undefined),
    onError,
  });
  processor = createProcessor({
    rnnoise,
    rnnoiseMix,
    onProcessedPcm,
    onPacket: (packet) => {
      const streamId = getStreamId();
      if (streamId) sendRecovery.send(streamId, packet);
    },
    onError,
  });

  function flush() {
    const streamId = getStreamId();
    if (!session.healthy()) {
      if (streamId) recovery.abandon(streamId);
      setStreamId(undefined);
      buffer.clear();
      processor.finishTransmission();
      idle.reset();
      recovery.stopAbandoned()?.catch(onError);
      return;
    }
    if (!streamId) return;
    try {
      buffer.flush((frame) => processor.write(frame));
    } catch (error) {
      if (!sendRecovery.handleFailure(error, streamId)) onError(error);
    }
  }

  return {
    flush,
    finishTransmission: () => processor.finishTransmission(),
    close: () => processor.close(),
  };
}
