export function createAudioIdleTimer({ idleMs, now, setTimeoutImpl, clearTimeoutImpl, onIdle }) {
  let timer;
  let lastActivity = 0;
  return {
    recordActivity() {
      lastActivity = now();
    },
    schedule() {
      if (timer !== undefined) clearTimeoutImpl(timer);
      timer = setTimeoutImpl(() => {
        timer = undefined;
        onIdle();
      }, idleMs);
    },
    isIdle(force = false) {
      return force || now() - lastActivity >= idleMs;
    },
    reset() {
      if (timer !== undefined) clearTimeoutImpl(timer);
      timer = undefined;
      lastActivity = 0;
    },
    cancel() {
      if (timer !== undefined) clearTimeoutImpl(timer);
      timer = undefined;
    },
  };
}
