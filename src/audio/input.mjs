import { createSocket } from "node:dgram";
import { createNoisePipeline } from "./noise-pipeline.mjs";

const INPUT_FRAME_BYTES = 320 * 4;

export function createAudioInput({
  port,
  session,
  rnnoise,
  rnnoiseMix = 1,
  createProcessor = createNoisePipeline,
  idleMs = 500,
  onError = () => {},
  createSocketImpl = createSocket,
  now = Date.now,
}) {
  const socket = createSocketImpl("udp4");
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

  function flush() {
    if (!session.healthy()) {
      streamId = undefined;
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
    if (streamId || starting || !session.healthy()) return;
    starting = session
      .startStream()
      .then((id) => {
        streamId = id;
        flush();
      })
      .catch(onError)
      .finally(() => {
        starting = undefined;
      });
  }

  async function end() {
    if (now() - lastPacketAt < idleMs) return;
    if (starting) await starting;
    if (now() - lastPacketAt < idleMs) return;
    flush();
    pcm = Buffer.alloc(0);
    processor.finishTransmission();
    const id = streamId;
    streamId = undefined;
    if (id) await session.stopStream(id).catch(onError);
  }

  function receive(packet) {
    if (!session.healthy()) return;
    lastPacketAt = now();
    pcm = Buffer.concat([pcm, packet]);
    begin();
    flush();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => end().catch(onError), idleMs);
  }

  socket.on("message", receive);
  socket.on("error", onError);
  const listen = () =>
    new Promise((resolve) => {
      socket.bind(port, "127.0.0.1", () => resolve(socket.address().port));
    });
  const close = async () => {
    clearTimeout(idleTimer);
    if (starting) await starting;
    lastPacketAt = 0;
    await end();
    processor.close();
    socket.close();
  };
  return { close, listen };
}
