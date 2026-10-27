import { createPcmQueue } from "./pcm-queue.mjs";

const maxBufferedBytes = 96000;
export function createBroadcastifyStream(settings, options = {}) {
  const {
    onError = () => {},
    getChild = () => undefined,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
  } = options;
  let keepalive,
    reportedBackpressure = false;
  let closed = false;
  const queue = createPcmQueue(onError);

  function send(pcm) {
    const child = getChild();
    if (!child?.stdin?.writable) return;
    try {
      child.stdin.write(pcm);
    } catch {
      onError(new Error("Broadcastify audio pipe write failed"));
    }
  }

  function write(pcm) {
    if (settings.enabled && !closed) queue.write(pcm);
  }

  function pump() {
    const child = getChild();
    if (!child) {
      queue.clear();
      return;
    }
    if (child.stdin.writableLength > maxBufferedBytes) {
      if (!reportedBackpressure) onError(new Error("Broadcastify audio pipe is congested"));
      reportedBackpressure = true;
      return;
    }
    reportedBackpressure = false;
    send(queue.next());
  }

  if (settings.enabled) keepalive = setIntervalImpl(pump, 10);
  return {
    write,
    close: () => {
      closed = true;
      if (keepalive) clearIntervalImpl(keepalive);
      queue.clear();
    },
  };
}
