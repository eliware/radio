import { createNoisePipeline } from "./noise-pipeline.mjs";
import { createAudioStreamRecovery } from "./stream-recovery.mjs";
import { createTransmissionIdle } from "./transmission-idle.mjs";
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
  let sendFailure;
  const processor = createProcessor({
    rnnoise,
    rnnoiseMix,
    onProcessedPcm,
    onPacket: (packet) => {
      if (!streamId) return;
      try {
        session.sendAudio(streamId, packet);
      } catch (error) {
        sendFailure = error;
        throw error;
      }
    },
    onError,
  });
  let streamId,
    starting,
    closed = false,
    pcm = Buffer.alloc(0);
  const recovery = createAudioStreamRecovery({
    session,
    onError,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
    isClosed: () => closed,
    onAbandonedStopped: () => !closed && pcm.length && begin(),
  });
  const idle = createTransmissionIdle({
    idleMs,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
    end,
    onError,
  });
  function flush() {
    if (!session.healthy()) {
      if (streamId) recovery.abandon(streamId);
      streamId = undefined;
      pcm = Buffer.alloc(0);
      processor.finishTransmission();
      idle.reset();
      recovery.stopAbandoned()?.catch(onError);
      return;
    }
    while (streamId && pcm.length >= 320 * 4) {
      const frame = pcm.subarray(0, 320 * 4);
      pcm = pcm.subarray(320 * 4);
      try {
        processor.write(frame);
      } catch (error) {
        if (sendFailure === error && streamId) {
          recovery.abandon(streamId);
          streamId = undefined;
          pcm = Buffer.alloc(0);
          recovery.failed(error);
          processor.finishTransmission();
          recovery.stopAbandoned()?.catch(onError);
        } else {
          onError(error);
        }
        sendFailure = undefined;
      }
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
        pcm = Buffer.alloc(0);
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
    pcm = pcm.subarray(0, pcm.length - (pcm.length % (320 * 4)));
    flush();
    pcm = Buffer.alloc(0);
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
      pcm = Buffer.concat([pcm, packet]);
      begin();
      flush();
      idle.schedule();
    },
    close,
  };
}
