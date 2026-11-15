import { createPcmQueue } from "./pcm-queue.mjs";
import { createBroadcastifyStreamPump } from "./pump.mjs";

export function createBroadcastifyStream(settings, options = {}) {
  const {
    onError = () => {},
    getChild = () => undefined,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
  } = options;
  let closed = false;
  const queue = createPcmQueue(onError);
  const pump = settings.enabled
    ? createBroadcastifyStreamPump({ queue, getChild, onError, setIntervalImpl, clearIntervalImpl })
    : undefined;

  function write(pcm) {
    if (settings.enabled && !closed) queue.write(pcm);
  }

  return {
    write,
    close: () => {
      closed = true;
      pump?.close();
      queue.clear();
    },
  };
}
