const silence = Buffer.alloc(960);
const maxQueuedBytes = 960000;

export function createPcmQueue(onError) {
  const chunks = [];
  let queuedBytes = 0;
  let congested = false;
  return {
    write(pcm) {
      if (pcm.length === 0 || pcm.length % 2) return;
      chunks.push(pcm);
      queuedBytes += pcm.length;
      while (queuedBytes > maxQueuedBytes) {
        queuedBytes -= chunks.shift().length;
        if (!congested) onError(new Error("Broadcastify audio queue exceeded 10 seconds"));
        congested = true;
      }
    },
    next() {
      const pcm = chunks.shift();
      if (!pcm) return silence;
      queuedBytes -= pcm.length;
      if (queuedBytes <= maxQueuedBytes / 2) congested = false;
      return pcm;
    },
    clear() {
      chunks.length = 0;
      queuedBytes = 0;
      congested = false;
    },
  };
}
