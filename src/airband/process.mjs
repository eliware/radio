export default function startAirbandProcess({
  configPath,
  serials,
  log,
  spawnProcess,
  onStarted,
  onError,
  shutdownTimeoutMs,
  setTimeoutImpl,
  clearTimeoutImpl,
}) {
  const child = spawnProcess("rtl_airband", ["-F", "-e", "-c", configPath], {
    stdio: "inherit",
  });
  let error,
    shutdownTimer,
    finished = false;
  let resolveFinished;
  const finishedTask = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  const finish = (result) => {
    if (finished) return;
    finished = true;
    if (shutdownTimer !== undefined) clearTimeoutImpl(shutdownTimer);
    child.off("spawn", onSpawn);
    child.off("error", onProcessError);
    child.off("close", onClose);
    resolveFinished(result);
  };
  const onSpawn = () => onStarted();
  const stop = () => {
    if (shutdownTimer !== undefined) return;
    shutdownTimer = setTimeoutImpl(() => {
      child.kill?.("SIGKILL");
      finish({ signal: "SIGKILL", ...(error && { cause: new Error(error) }) });
    }, shutdownTimeoutMs);
    child.kill?.("SIGTERM");
  };
  const onProcessError = (cause) => {
    error = cause.message;
    onError(cause);
    stop();
  };
  const onClose = (code, signal) =>
    finish({ code, signal, ...(error && { cause: new Error(error) }) });

  log.info("Starting RTLSDR-Airband", { serials });
  child.once("spawn", onSpawn);
  child.once("error", onProcessError);
  child.once("close", onClose);
  return { child, finished: finishedTask, stop };
}
