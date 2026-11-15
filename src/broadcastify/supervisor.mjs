import { spawn } from "node:child_process";
import { createFfmpegArgs } from "./ffmpeg-args.mjs";
import { createBroadcastifyRetry } from "./retry.mjs";
import { createBroadcastifyStability } from "./stability.mjs";
import { monitorBroadcastifyProcess } from "./process.mjs";

export function createBroadcastifySupervisor(
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
  const retry = createBroadcastifyRetry({ setTimeoutImpl, clearTimeoutImpl });
  const stability = createBroadcastifyStability({
    onStable: () => retry.reset(),
    setTimeoutImpl,
    clearTimeoutImpl,
  });

  function scheduleRestart() {
    if (closed) return;
    state = "retrying";
    retry.schedule(start);
  }

  function start() {
    if (closed || !settings.enabled) return;
    state = "connecting";
    try {
      child = spawnProcess("ffmpeg", createFfmpegArgs(settings), {
        stdio: ["pipe", "ignore", "pipe"],
      });
      const process = child;
      monitorBroadcastifyProcess(child, {
        settings,
        isCurrent: () => child === process,
        isClosed: () => closed,
        onError,
        onProcessError: () => {
          state = "retrying";
          scheduleRestart();
        },
        onSpawn: () => {
          state = "running";
          stability.observe(60000);
        },
        onClose: () => {
          stability.cancel();
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
      retry.close();
      stability.close();
      state = "closed";
      const process = child;
      if (!process) return Promise.resolve();
      closing = new Promise((resolve) => {
        let forceTimer;
        const finish = () => {
          clearTimeoutImpl(forceTimer);
          process.off("close", finish);
          child = undefined;
          resolve();
        };
        process.once("close", finish);
        forceTimer = setTimeoutImpl(() => {
          process.kill("SIGKILL");
          finish();
        }, 5000);
        process.stdin.end();
        process.kill("SIGTERM");
      });
      return closing;
    },
  };
}
