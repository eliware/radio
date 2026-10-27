import { spawn } from "node:child_process";
import { createFfmpegArgs } from "./ffmpeg-args.mjs";
import { sanitizeBroadcastifyStderr } from "./stderr-sanitizer.mjs";
import { createBroadcastifyRetry } from "./retry.mjs";

export function createBroadcastifySupervisor(
  settings,
  {
    spawnProcess = spawn,
    onError = () => {},
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  let child, stableTimer, closing;
  let state = settings.enabled ? "connecting" : "disabled";
  let closed = false;
  const retry = createBroadcastifyRetry({ setTimeoutImpl, clearTimeoutImpl });

  function scheduleRestart() {
    if (closed) return;
    state = "retrying";
    retry.schedule(start);
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
        if (closed || child !== process) return;
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
          retry.reset();
        }, 60000);
      });
      child.on("close", (code, signal) => {
        if (child !== process) return;
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
      retry.close();
      if (stableTimer) clearTimeoutImpl(stableTimer);
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
