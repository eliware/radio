export default function createPcmFrameBuffer(frameBytes) {
  const buffered = Buffer.alloc(frameBytes);
  let bufferedBytes = 0;

  return {
    write(chunk, onFrame) {
      let offset = 0;
      while (offset < chunk.length) {
        const copied = Math.min(frameBytes - bufferedBytes, chunk.length - offset);
        chunk.copy(buffered, bufferedBytes, offset, offset + copied);
        bufferedBytes += copied;
        offset += copied;
        if (bufferedBytes === frameBytes) {
          onFrame(buffered);
          bufferedBytes = 0;
        }
      }
    },
    reset() {
      bufferedBytes = 0;
    },
  };
}
