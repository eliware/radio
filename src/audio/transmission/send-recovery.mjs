export function createTransmissionSendRecovery({
  session,
  recovery,
  buffer,
  finishTransmission,
  onAbandon,
  onError,
}) {
  let sendFailure;

  return {
    send(streamId, packet) {
      try {
        session.sendAudio(streamId, packet);
      } catch (error) {
        sendFailure = error;
        throw error;
      }
    },
    handleFailure(error, streamId) {
      const causedBySend = sendFailure === error && Boolean(streamId);
      if (causedBySend) {
        onAbandon(streamId);
        recovery.abandon(streamId);
        buffer.clear();
        recovery.failed(error);
        finishTransmission();
        recovery.stopAbandoned()?.catch(onError);
      }
      sendFailure = undefined;
      return causedBySend;
    },
  };
}
