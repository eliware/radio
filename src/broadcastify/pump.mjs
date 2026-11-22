import createBroadcastifyPipePump from "./pipe-pump.mjs";

export default function createBroadcastifyStreamPump({
  queue,
  getChild,
  onError,
  setIntervalImpl,
  clearIntervalImpl,
}) {
  const pumpPipe = createBroadcastifyPipePump({
    getChild,
    nextPcm: () => queue.next(),
    onError,
  });
  const timer = setIntervalImpl(() => {
    if (!pumpPipe()) queue.clear();
  }, 10);
  return { close: () => clearIntervalImpl(timer) };
}
