import { createNoisePipeline } from "./noise-pipeline.mjs";
import { createAudioStreamRecovery } from "./transmission/recovery.mjs";
import { createTransmissionIdle } from "./transmission/idle.mjs";
import { createTransmissionBuffer } from "./transmission/buffer.mjs";
import { createTransmissionSendRecovery } from "./transmission/send-recovery.mjs";
import { createTransmissionStart } from "./transmission/start.mjs";
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
    closed = false,
    processor;
  let start;
  const buffer = createTransmissionBuffer();
  const recovery = createAudioStreamRecovery({
    session,
    onError,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
    isClosed: () => closed,
    onAbandonedStopped: () => !closed && buffer.length && start.begin(),
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
  start = createTransmissionStart({
    session,
    recovery,
    buffer,
    processor,
    isClosed: () => closed,
    hasStream: () => Boolean(streamId),
    onStarted: (id) => {
      streamId = id;
      flush();
    },
    onError,
  });
  async function end(force = false) {
    if ((closed && !force) || !idle.isIdle(force)) return;
    if (start.isStarting) await start.wait();
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
    if (start.isStarting) await start.wait();
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
      start.begin();
      flush();
      idle.schedule();
    },
    close,
  };
}
