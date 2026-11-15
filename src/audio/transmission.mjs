import { createNoisePipeline } from "./noise-pipeline.mjs";
import { createAudioStreamRecovery } from "./transmission/recovery.mjs";
import { createTransmissionIdle } from "./transmission/idle.mjs";
import { createTransmissionBuffer } from "./transmission/buffer.mjs";
import { createTransmissionSendRecovery } from "./transmission/send-recovery.mjs";
export function createAudioTransmission({
  session,
  rnnoise,
  rnnoiseMix = 1,
  onProcessedPcm,
  createProcessor = createNoisePipeline,
  idleMs = 500,
  onError = () => {},
  now = Date.now,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  let streamId,
    starting,
    closed = false,
    processor;
  const buffer = createTransmissionBuffer();
  const recovery = createAudioStreamRecovery({
    session,
    onError,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
    isClosed: () => closed,
    onAbandonedStopped: () => !closed && buffer.length && begin(),
  });
  const idle = createTransmissionIdle({
    idleMs,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
    end,
    onError,
  });
  const sendRecovery = createTransmissionSendRecovery({
    session,
    recovery,
    buffer,
    finishTransmission: () => processor.finishTransmission(),
    onAbandon: () => {
      streamId = undefined;
    },
    onError,
  });
  processor = createProcessor({
    rnnoise,
    rnnoiseMix,
    onProcessedPcm,
    onPacket: (packet) => {
      if (streamId) sendRecovery.send(streamId, packet);
    },
    onError,
  });
  function flush() {
    if (!session.healthy()) {
      if (streamId) recovery.abandon(streamId);
      streamId = undefined;
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
  function begin() {
    if (
      closed ||
      streamId ||
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
        if (closed) return recovery.stopOrAbandon(id);
        streamId = id;
        flush();
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
  async function end(force = false) {
    if ((closed && !force) || !idle.isIdle(force)) return;
    if (starting) await starting;
    if (!idle.isIdle(force)) return;
    buffer.keepCompleteFrames();
    flush();
    buffer.clear();
    processor.finishTransmission();
    const id = streamId;
    streamId = undefined;
    await recovery.stopOrAbandon(id);
  }
  async function close() {
    if (closed) return;
    closed = true;
    idle.reset();
    recovery.cancelAbandonedStop();
    if (starting) await starting;
    await recovery.stopAbandoned();
    await end(true);
    await recovery.stopAbandoned();
    processor.close();
  }

  return {
    receive(packet) {
      if (closed || !session.healthy()) return;
      idle.recordActivity();
      if (!recovery.canStart()) return;
      buffer.append(packet);
      begin();
      flush();
      idle.schedule();
    },
    close,
  };
}
