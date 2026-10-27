import { spawn } from "node:child_process";
import { createFfmpegArgs } from "./ffmpeg-args.mjs";
import { sanitizeBroadcastifyStderr } from "./stderr-sanitizer.mjs";

export function createBroadcastifySupervisor(
  settings,
  {
    spawnProcess = spawn,
    onError = () => {},
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  let child, retryTimer, stableTimer, closing;
  let retryDelay = 1000;
  let state = settings.enabled ? "connecting" : "disabled";
  let closed = false;

  function scheduleRestart() {
    if (closed || retryTimer) return;
    state = "retrying";
    retryTimer = setTimeoutImpl(() => {
      retryTimer = undefined;
      start();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 300000);
  }

  function start() {
    if (closed || !settings.enabled) return;
    state = "connecting";
    try {
      let failed = false;
      let stderr = "";
      child = spawnProcess("ffmpeg", createFfmpegArgs(settings), {
        stdio: ["pipe", "ignore", "pipe"],
      });
      const process = child;
      child.stderr?.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-4096);
      });
      child.stdin.on("error", () => onError(new Error("Broadcastify audio pipe failed")));
      child.on("error", () => {
        if (closed) return;
        failed = true;
        state = "retrying";
        onError(new Error("Broadcastify FFmpeg process failed"));
        scheduleRestart();
      });
      child.on("spawn", () => {
        if (closed || child !== process) return;
        state = "running";
        stableTimer = setTimeoutImpl(() => {
          stableTimer = undefined;
          retryDelay = 1000;
        }, 60000);
      });
      child.on("close", (code, signal) => {
        if (stableTimer) clearTimeoutImpl(stableTimer);
        stableTimer = undefined;
        child = undefined;
        if (!closed) {
          if (!failed) {
            const detail = sanitizeBroadcastifyStderr(stderr, settings);
            const reason = [code === null ? signal : `code ${code}`, detail]
              .filter(Boolean)
              .join(": ");
            onError(new Error(`${settings.name || "Broadcastify"} FFmpeg exited (${reason})`));
          }
          scheduleRestart();
        }
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
      if (retryTimer) clearTimeoutImpl(retryTimer);
      if (stableTimer) clearTimeoutImpl(stableTimer);
      state = "closed";
      const process = child;
      if (!process) return Promise.resolve();
      closing = new Promise((resolve) => {
        const forceTimer = setTimeoutImpl(() => process.kill("SIGKILL"), 5000);
        process.once("close", () => {
          clearTimeoutImpl(forceTimer);
          child = undefined;
          resolve();
        });
        process.stdin.end();
        process.kill("SIGTERM");
      });
      return closing;
    },
  };
}
