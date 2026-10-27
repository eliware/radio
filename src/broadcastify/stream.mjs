import { createPcmQueue } from "./pcm-queue.mjs";
import { createBroadcastifySupervisor } from "./supervisor.mjs";

const maxBufferedBytes = 96000;
export function createBroadcastifyStream(settings, options = {}) {
  const {
    onError = () => {},
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
  } = options;
  let keepalive,
    reportedBackpressure = false;
  let closed = false;
  const supervisor = createBroadcastifySupervisor(settings, options);
  const queue = createPcmQueue(onError);

  function send(pcm) {
    const child = supervisor.child;
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
    const child = supervisor.child;
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
    ready: supervisor.ready,
    status: supervisor.status,
    close: async () => {
      closed = true;
      if (keepalive) clearIntervalImpl(keepalive);
      queue.clear();
      await supervisor.close();
    },
  };
}
