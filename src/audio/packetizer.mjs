import { createEncoder, encodePcmFrame, FRAME_BYTES } from "./codec.mjs";

export function createAudioPacketizer({ onPacket, createEncoderImpl = createEncoder }) {
  const encoder = createEncoderImpl();
  let pcm = Buffer.alloc(0);
  let closed = false;

  return {
    write(chunk) {
      if (closed) throw new Error("Audio packetizer is closed");
      pcm = Buffer.concat([pcm, chunk]);
      while (pcm.length >= FRAME_BYTES / 2) {
        const frame = pcm.subarray(0, FRAME_BYTES / 2);
        pcm = pcm.subarray(FRAME_BYTES / 2);
        onPacket(encodePcmFrame(encoder, frame));
      }
    },
    reset() {
      if (!closed) pcm = Buffer.alloc(0);
    },
    close() {
      if (closed) return;
      closed = true;
      pcm = Buffer.alloc(0);
      encoder.delete();
    },
  };
}
