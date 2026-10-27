import { createNoisePipeline } from "./noise-pipeline.mjs";
import { createAudioStreamRecovery } from "./stream-recovery.mjs";
import { createTransmissionIdle } from "./transmission-idle.mjs";

const INPUT_FRAME_BYTES = 320 * 4;
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
  let pcm = Buffer.alloc(0),
    streamId,
    starting;
  let closed = false;
  const recovery = createAudioStreamRecovery({ session, onError, now });
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
      return;
    }
    while (streamId && pcm.length >= INPUT_FRAME_BYTES) {
      const frame = pcm.subarray(0, INPUT_FRAME_BYTES);
      pcm = pcm.subarray(INPUT_FRAME_BYTES);
      try {
        processor.write(frame);
      } catch (error) {
        if (sendFailure === error && streamId) {
          recovery.abandon(streamId);
          streamId = undefined;
          pcm = Buffer.alloc(0);
          recovery.failed(error);
          processor.finishTransmission();
          stopAbandonedStreams()?.catch(onError);
        } else {
          onError(error);
        }
        sendFailure = undefined;
      }
    }
  }
  function stopAbandonedStreams() {
    return recovery.stopAbandoned(() => {
      if (!closed && pcm.length) begin();
    });
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
      stopAbandonedStreams()?.catch(onError);
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
    pcm = pcm.subarray(0, pcm.length - (pcm.length % INPUT_FRAME_BYTES));
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
    if (starting) await starting;
    await stopAbandonedStreams();
    await end(true);
    await stopAbandonedStreams();
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
