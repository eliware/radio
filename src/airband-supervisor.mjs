import { spawn } from "node:child_process";
import { logger as defaultLogger } from "./logger.mjs";
import { hasUsbSerial } from "./usb/device.mjs";
import { waitForAirbandDevices } from "./airband/device-monitor.mjs";

export function createAirbandSupervisor({
  configs,
  configPath,
  wait,
  onError,
  log = defaultLogger,
  present = hasUsbSerial,
  spawnProcess = spawn,
  waitForDevices = waitForAirbandDevices,
}) {
  let stopped = false;
  let child;
  let state = "waiting-for-sdrs";
  let error;
  let finishStartingChild;
  let resolveStop;
  const stopSignal = new Promise((resolve) => {
    resolveStop = resolve;
  });
  const pause = (ms) => Promise.race([wait(ms), stopSignal]);

  async function run() {
    let delay = 1000;
    while (!stopped) {
      try {
        const ready = await waitForDevices(configs, {
          present,
          wait: pause,
          shouldStop: () => stopped,
          onMissing: () => {
            delay = 1000;
            state = "waiting-for-sdrs";
          },
        });
        if (!ready) break;
        if (stopped) break;
        error = undefined;
        state = "starting";
        log.info("Starting RTLSDR-Airband", {
          serials: configs.map(({ SDR_SERIAL }) => SDR_SERIAL),
        });
        child = spawnProcess("rtl_airband", ["-F", "-e", "-c", configPath], {
          stdio: "inherit",
        });
        const result = await new Promise((resolve) => {
          const process = child;
          let spawned = false;
          const finish = (result) => {
            finishStartingChild = undefined;
            process.off("spawn", onSpawn);
            process.off("error", onProcessError);
            process.off("close", onClose);
            resolve(result);
          };
          const onSpawn = () => {
            spawned = true;
            state = "running";
            log.info("RTLSDR-Airband started");
          };
          finishStartingChild = () => {
            if (!spawned) finish({ signal: "SIGTERM" });
          };
          const onProcessError = (cause) => {
            state = "error";
            error = cause.message;
            process.kill?.("SIGTERM");
          };
          const onClose = (code, signal) => {
            finish({ code, signal, ...(error && { cause: new Error(error) }) });
          };
          child.once("spawn", onSpawn);
          child.once("error", onProcessError);
          child.once("close", onClose);
        });
        child = undefined;
        if (stopped) break;
        state = result.cause ? "error" : "waiting-for-sdrs";
        error = result.cause?.message ?? `RTLSDR-Airband exited (${result.code ?? result.signal})`;
        onError(new Error(error));
      } catch (cause) {
        child = undefined;
        state = "error";
        error = cause.message;
        onError(cause);
      }
      const retryDelay = delay;
      delay = Math.min(delay * 2, 30000);
      if (!stopped) await pause(retryDelay);
    }
  }

  const task = run();
  return {
    close: async () => {
      stopped = true;
      resolveStop();
      state = "stopped";
      finishStartingChild?.();
      child?.kill("SIGTERM");
      await task;
    },
    ready: () => state === "running",
    status: () => ({ state, error }),
  };
}
