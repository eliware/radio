export function shutdownBroadcastifyProcess(
  process,
  { setTimeoutImpl, clearTimeoutImpl, timeoutMs },
) {
  return new Promise((resolve) => {
    let timer;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer !== undefined) clearTimeoutImpl(timer);
      process.off("close", finish);
      resolve();
    };
    process.once("close", finish);
    timer = setTimeoutImpl(() => {
      process.kill("SIGKILL");
      finish();
    }, timeoutMs);
    process.stdin.end();
    process.kill("SIGTERM");
  });
}
