import { createSocket } from "node:dgram";
import { FRAME_BYTES, createEncoder, encodeFloatFrame } from "./codec.mjs";

export function createAudioInput({
  port,
  session,
  idleMs = 500,
  onError = () => {},
  createSocketImpl = createSocket,
  now = Date.now,
}) {
  const socket = createSocketImpl("udp4");
  const encoder = createEncoder();
  let pcm = Buffer.alloc(0);
  let streamId;
  let starting;
  let idleTimer;
  let lastPacketAt = 0;

  function flush() {
    if (!session.healthy()) {
      streamId = undefined;
      pcm = Buffer.alloc(0);
      return;
    }
    while (streamId && pcm.length >= FRAME_BYTES) {
      const frame = pcm.subarray(0, FRAME_BYTES);
      pcm = pcm.subarray(FRAME_BYTES);
      try {
        session.sendAudio(streamId, encodeFloatFrame(encoder, frame));
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
    encoder.delete();
    socket.close();
  };
  return { close, listen };
}
