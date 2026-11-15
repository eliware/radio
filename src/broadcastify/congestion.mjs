export function createPcmCongestionPolicy(queue, onError, maxQueuedBytes = 960000) {
  let congested = false;
  return {
    write(pcm) {
      queue.write(pcm);
      while (queue.queuedBytes > maxQueuedBytes) {
        queue.discardOldest();
        if (!congested) onError(new Error("Broadcastify audio queue exceeded 10 seconds"));
        congested = true;
      }
    },
    next() {
      const pcm = queue.next();
      if (queue.queuedBytes <= maxQueuedBytes / 2) congested = false;
      return pcm;
    },
    clear() {
      queue.clear();
      congested = false;
    },
  };
}
