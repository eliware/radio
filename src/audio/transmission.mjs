import createNoisePipeline from "./noise-pipeline.mjs";
import createAudioStreamRecovery from "./transmission/recovery.mjs";
import createTransmissionIdle from "./transmission/idle.mjs";
import createTransmissionBuffer from "./transmission/buffer.mjs";
import createTransmissionStart from "./transmission/start.mjs";
import createTransmissionSend from "./transmission/send.mjs";
import createTransmissionEnd from "./transmission/end.mjs";
export default function createAudioTransmission({
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
    closed = false;
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
  let idle;
  let completeTransmission;
  const end = (force = false) => completeTransmission(force);
  idle = createTransmissionIdle({
    idleMs,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
    end,
    onError,
  });
  const sender = createTransmissionSend({
    session,
    rnnoise,
    rnnoiseMix,
    onProcessedPcm,
    createProcessor,
    recovery,
    buffer,
    idle,
    getStreamId: () => streamId,
    setStreamId: (id) => {
      streamId = id;
    },
    onError,
  });
  start = createTransmissionStart({
    session,
    recovery,
    finishTransmission: sender.finishTransmission,
    isClosed: () => closed,
    hasStream: () => Boolean(streamId),
    onStarted: (id) => {
      streamId = id;
      sender.flush();
    },
    onError,
    setTimeoutImpl,
    clearTimeoutImpl,
  });
  completeTransmission = createTransmissionEnd({
    isClosed: () => closed,
    isIdle: (force) => idle.isIdle(force),
    isStarting: () => start.isStarting,
    waitForStart: start.wait,
    rescheduleIdle: () => idle.schedule(),
    buffer,
    sender,
    getStreamId: () => streamId,
    setStreamId: (id) => {
      streamId = id;
    },
    recovery,
  });
  async function close() {
    if (closed) return;
    closed = true;
    idle.reset();
    start.close();
    recovery.cancelAbandonedStop();
    if (start.isStarting) await start.wait();
    try {
      await recovery.stopAbandoned();
      await end(true);
      await recovery.stopAbandoned();
    } finally {
      sender.close();
    }
  }

  return {
    receive(packet) {
      if (closed || !session.healthy()) return;
      idle.recordActivity();
      if (!recovery.canStart()) return;
      buffer.append(packet);
      start.begin();
      sender.flush();
      idle.schedule();
    },
    close,
  };
}
