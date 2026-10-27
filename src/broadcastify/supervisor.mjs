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
  let child, retryTimer, stableTimer;
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
      state = "running";
      stableTimer = setTimeoutImpl(() => {
        stableTimer = undefined;
        retryDelay = 1000;
      }, 60000);
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
    ready: () => state === "running" || state === "disabled",
    status: () => ({ state }),
    close: () => {
      closed = true;
      if (retryTimer) clearTimeoutImpl(retryTimer);
      if (stableTimer) clearTimeoutImpl(stableTimer);
      child?.stdin.end();
      child?.kill("SIGTERM");
      child = undefined;
      state = "closed";
    },
  };
}
