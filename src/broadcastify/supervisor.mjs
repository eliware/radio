import { spawn } from "node:child_process";
import startBroadcastifyProcess from "./start.mjs";
import createBroadcastifyRestartPolicy from "./restart-policy.mjs";
import monitorBroadcastifyProcess from "./process.mjs";
import shutdownBroadcastifyProcess from "./shutdown.mjs";

export default function createBroadcastifySupervisor(
  settings,
  {
    spawnProcess = spawn,
    onError = () => {},
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  let child, closing;
  let state = settings.enabled ? "connecting" : "disabled";
  let closed = false;
  const restartPolicy = createBroadcastifyRestartPolicy({ setTimeoutImpl, clearTimeoutImpl });

  function scheduleRestart() {
    if (closed) return;
    state = "retrying";
    restartPolicy.schedule(start);
  }

  function start() {
    if (closed || !settings.enabled) return;
    state = "connecting";
    try {
      child = startBroadcastifyProcess(settings, spawnProcess);
      const process = child;
      monitorBroadcastifyProcess(child, {
        settings,
        isCurrent: () => child === process,
        isClosed: () => closed,
        onError,
        onProcessError: () => (state = "retrying"),
        onSpawn: () => {
          state = "running";
          restartPolicy.observe(60000);
        },
        onClose: () => {
          restartPolicy.cancelStability();
          child = undefined;
          if (!closed) scheduleRestart();
        },
      });
    } catch {
      child = undefined;
      onError(new Error("Broadcastify FFmpeg could not start"));
      scheduleRestart();
    }
  }

  if (settings.enabled) start();
  return {
    get child() {
      return child;
    },
    ready: () => state === "disabled" || (state === "running" && Boolean(child?.stdin?.writable)),
    status: () => ({ state }),
    close: () => {
      if (closing) return closing;
      closed = true;
      restartPolicy.close();
      state = "closed";
      const process = child;
      if (!process) return Promise.resolve();
      closing = shutdownBroadcastifyProcess(process, {
        setTimeoutImpl,
        clearTimeoutImpl,
        timeoutMs: 5000,
      }).then(() => {
        child = undefined;
      });
      return closing;
    },
  };
}
