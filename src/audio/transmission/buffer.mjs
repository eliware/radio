const frameBytes = 320 * 4;

export function createTransmissionBuffer() {
  let pcm = Buffer.alloc(0);

  return {
    append(packet) {
      pcm = Buffer.concat([pcm, packet]);
    },
    clear() {
      pcm = Buffer.alloc(0);
    },
    flush(onFrame) {
      while (pcm.length >= frameBytes) {
        const frame = pcm.subarray(0, frameBytes);
        pcm = pcm.subarray(frameBytes);
        onFrame(frame);
      }
    },
    keepCompleteFrames() {
      pcm = pcm.subarray(0, pcm.length - (pcm.length % frameBytes));
    },
    get length() {
      return pcm.length;
    },
  };
}
