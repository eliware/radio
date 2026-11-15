import { FRAME_SAMPLES } from "../codec.mjs";

const frameBytes = (FRAME_SAMPLES / 3) * 4;

export function createTransmissionBuffer() {
  let chunks = [];
  let length = 0;

  function take(size) {
    if (chunks[0].length >= size) {
      const frame = chunks[0].subarray(0, size);
      chunks[0] = chunks[0].subarray(size);
      if (chunks[0].length === 0) chunks.shift();
      length -= size;
      return frame;
    }
    const frame = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const chunk = chunks[0];
      const copied = Math.min(chunk.length, size - offset);
      chunk.copy(frame, offset, 0, copied);
      offset += copied;
      if (copied === chunk.length) chunks.shift();
      else chunks[0] = chunk.subarray(copied);
    }
    length -= size;
    return frame;
  }

  function discard(size) {
    const discarded = size;
    while (size > 0) {
      const chunk = chunks[0];
      if (chunk.length <= size) {
        size -= chunk.length;
        chunks.shift();
      } else {
        chunks[0] = chunk.subarray(size);
        size = 0;
      }
    }
    length -= discarded;
  }

  return {
    append(packet) {
      if (packet.length === 0) return;
      chunks.push(packet);
      length += packet.length;
    },
    clear() {
      chunks = [];
      length = 0;
    },
    flush(onFrame) {
      while (length >= frameBytes) onFrame(take(frameBytes));
    },
    keepCompleteFrames() {
      discard(length % frameBytes);
    },
    get length() {
      return length;
    },
  };
}
