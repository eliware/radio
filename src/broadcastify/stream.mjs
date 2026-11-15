import { createPcmQueue } from "./pcm-queue.mjs";
import { createBroadcastifyPipePump } from "./pipe-pump.mjs";

export function createBroadcastifyStream(settings, options = {}) {
  const {
    onError = () => {},
    getChild = () => undefined,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
  } = options;
  let keepalive;
  let closed = false;
  const queue = createPcmQueue(onError);
  const pumpPipe = createBroadcastifyPipePump({
    getChild,
    nextPcm: () => queue.next(),
    onError,
  });

  function write(pcm) {
    if (settings.enabled && !closed) queue.write(pcm);
  }

  function pump() {
    if (!pumpPipe()) queue.clear();
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
