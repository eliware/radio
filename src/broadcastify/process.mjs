import sanitizeBroadcastifyStderr from "./stderr-sanitizer.mjs";

export default function monitorBroadcastifyProcess(
  child,
  { settings, isCurrent, isClosed, onError, onSpawn, onProcessError, onClose },
) {
  let failed = false;
  let stderr = "";
  function fail(error) {
    if (!isCurrent() || isClosed() || failed) return;
    failed = true;
    onError(error);
    onProcessError();
  }
  child.stderr?.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4096);
  });
  child.stdin.on("error", () => fail(new Error("Broadcastify audio pipe failed")));
  child.on("error", () => fail(new Error("Broadcastify FFmpeg process failed")));
  child.on("spawn", () => {
    if (!isCurrent() || isClosed()) return;
    onSpawn();
  });
  child.on("close", (code, signal) => {
    if (!isCurrent()) return;
    if (!failed && !isClosed()) {
      const detail = sanitizeBroadcastifyStderr(stderr, settings);
      const reason = [code === null ? signal : `code ${code}`, detail].filter(Boolean).join(": ");
      onError(new Error(`${settings.name || "Broadcastify"} FFmpeg exited (${reason})`));
    }
    onClose({ failed });
  });
}
