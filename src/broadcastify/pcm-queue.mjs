const silence = Buffer.alloc(960);
export function createPcmQueue() {
  const chunks = [];
  let queuedBytes = 0;
  return {
    write(pcm) {
      if (pcm.length === 0 || pcm.length % 2) return;
      chunks.push(pcm);
      queuedBytes += pcm.length;
    },
    next() {
      const pcm = chunks.shift();
      if (!pcm) return silence;
      queuedBytes -= pcm.length;
      return pcm;
    },
    discardOldest() {
      const pcm = chunks.shift();
      if (!pcm) return undefined;
      queuedBytes -= pcm.length;
      return pcm;
    },
    clear() {
      chunks.length = 0;
      queuedBytes = 0;
    },
    get queuedBytes() {
      return queuedBytes;
    },
  };
}
