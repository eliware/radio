const silence = Buffer.alloc(960);
const maxQueuedBytes = 96000;

export function createPcmQueue(onError) {
  const chunks = [];
  let queuedBytes = 0;
  let congested = false;
  return {
    write(pcm) {
      if (pcm.length % 2) return;
      chunks.push(pcm);
      queuedBytes += pcm.length;
      if (queuedBytes > maxQueuedBytes) {
        queuedBytes -= chunks.shift().length;
        if (!congested) onError(new Error("Broadcastify audio queue is congested"));
        congested = true;
      }
    },
    next() {
      const pcm = chunks.shift();
      if (!pcm) return silence;
      queuedBytes -= pcm.length;
      congested = false;
      return pcm;
    },
    clear() {
      chunks.length = 0;
      queuedBytes = 0;
      congested = false;
    },
  };
}
