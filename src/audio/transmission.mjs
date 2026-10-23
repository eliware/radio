import { createNoisePipeline } from "./noise-pipeline.mjs";

const INPUT_FRAME_BYTES = 320 * 4;

export function createAudioTransmission({
  session,
  rnnoise,
  rnnoiseMix = 1,
  createProcessor = createNoisePipeline,
  idleMs = 500,
  onError = () => {},
  now = Date.now,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  const processor = createProcessor({
    rnnoise,
    rnnoiseMix,
    onPacket: (packet) => streamId && session.sendAudio(streamId, packet),
    onError,
  });
  let pcm = Buffer.alloc(0);
  let streamId;
  let starting;
  let idleTimer;
  let lastPacketAt = 0;
  let retryAt = 0;
  let retryDelay = 1000;
  let closed = false;

  function flush() {
    if (!session.healthy()) {
      if (!closed) streamId = undefined;
      pcm = Buffer.alloc(0);
      processor.finishTransmission();
      return;
    }
    while (streamId && pcm.length >= INPUT_FRAME_BYTES) {
      const frame = pcm.subarray(0, INPUT_FRAME_BYTES);
      pcm = pcm.subarray(INPUT_FRAME_BYTES);
      try {
        processor.write(frame);
      } catch (error) {
        onError(error);
      }
    }
  }

  function begin() {
    if (streamId || starting || !session.healthy() || now() < retryAt) return;
    starting = session
      .startStream()
      .then((id) => {
        streamId = id;
        retryAt = 0;
        retryDelay = 1000;
        flush();
      })
      .catch((error) => {
        pcm = Buffer.alloc(0);
        processor.finishTransmission();
        retryAt = now() + retryDelay;
        retryDelay = Math.min(retryDelay * 2, 30000);
        onError(error);
      })
      .finally(() => {
        starting = undefined;
      });
  }

  async function end(force = false) {
    if (closed && !force) return;
    if (!force && now() - lastPacketAt < idleMs) return;
    if (starting) await starting;
    if (!force && now() - lastPacketAt < idleMs) return;
    flush();
    pcm = Buffer.alloc(0);
    processor.finishTransmission();
    const id = streamId;
    streamId = undefined;
    if (id && session.healthy()) await session.stopStream(id).catch(onError);
  }

  async function close() {
    if (closed) return;
    closed = true;
    clearTimeoutImpl(idleTimer);
    if (starting) await starting;
    lastPacketAt = 0;
    await end(true);
    processor.close();
  }

  return {
    receive(packet) {
      if (closed || !session.healthy()) return;
      lastPacketAt = now();
      if (now() < retryAt) return;
      pcm = Buffer.concat([pcm, packet]);
      begin();
      flush();
      clearTimeoutImpl(idleTimer);
      idleTimer = setTimeoutImpl(() => end().catch(onError), idleMs);
    },
    close,
  };
}
