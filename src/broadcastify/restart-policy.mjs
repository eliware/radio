import createBroadcastifyRetry from "./retry.mjs";
import createBroadcastifyStability from "./stability.mjs";

export default function createBroadcastifyRestartPolicy({ setTimeoutImpl, clearTimeoutImpl }) {
  const retry = createBroadcastifyRetry({ setTimeoutImpl, clearTimeoutImpl });
  const stability = createBroadcastifyStability({
    onStable: () => retry.reset(),
    setTimeoutImpl,
    clearTimeoutImpl,
  });
  return {
    schedule: (callback) => retry.schedule(callback),
    observe: (durationMs) => stability.observe(durationMs),
    cancelStability: () => stability.cancel(),
    close() {
      retry.close();
      stability.close();
    },
  };
}
