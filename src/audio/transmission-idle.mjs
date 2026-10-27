import { createAudioIdleTimer } from "./idle-timer.mjs";

export function createTransmissionIdle({
  idleMs,
  now,
  setTimeoutImpl,
  clearTimeoutImpl,
  end,
  onError,
}) {
  return createAudioIdleTimer({
    idleMs,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
    onIdle: () => end().catch(onError),
  });
}
