import { FRAME_BYTES } from "./codec.mjs";
import { createEncoder, encodePcmFrame } from "./encoder.mjs";

export function createAudioPacketizer({ onPacket, createEncoderImpl = createEncoder }) {
  const encoder = createEncoderImpl();
  const frameBytes = FRAME_BYTES / 2;
  const pending = Buffer.alloc(frameBytes);
  let pendingBytes = 0;
  let closed = false;

  return {
    write(chunk) {
      if (closed) throw new Error("Audio packetizer is closed");
      let offset = 0;
      if (pendingBytes > 0) {
        const copied = Math.min(frameBytes - pendingBytes, chunk.length);
        chunk.copy(pending, pendingBytes, 0, copied);
        pendingBytes += copied;
        offset += copied;
        if (pendingBytes === frameBytes) {
          onPacket(encodePcmFrame(encoder, pending));
          pendingBytes = 0;
        }
      }
      while (offset + frameBytes <= chunk.length) {
        onPacket(encodePcmFrame(encoder, chunk.subarray(offset, offset + frameBytes)));
        offset += frameBytes;
      }
      if (offset < chunk.length) {
        pendingBytes = chunk.copy(pending, 0, offset);
      }
    },
    reset() {
      if (!closed) pendingBytes = 0;
    },
    close() {
      if (closed) return;
      closed = true;
      pendingBytes = 0;
      encoder.delete();
    },
  };
}
