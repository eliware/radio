import { spawn } from "node:child_process";
import { logger as defaultLogger } from "./logger.mjs";
import { hasUsbSerial } from "./usb/device.mjs";
import { waitForAirbandDevices } from "./airband/device-monitor.mjs";
import { createAirbandRetry } from "./airband/retry.mjs";
import { startAirbandProcess } from "./airband/process.mjs";

export function createAirbandSupervisor({
  configs,
  configPath,
  wait,
  onError,
  log = defaultLogger,
  present = hasUsbSerial,
  spawnProcess = spawn,
  waitForDevices = waitForAirbandDevices,
  shutdownTimeoutMs = 5000,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  let stopped = false;
  let state = "waiting-for-sdrs";
  let error;
  let stopRunningProcess;
  let resolveStop;
  const stopSignal = new Promise((resolve) => {
    resolveStop = resolve;
  });
  const pause = (ms) => Promise.race([wait(ms), stopSignal]);
  const retry = createAirbandRetry();
  let presenceCheckFailed = false;
  const checkPresence = async (serial) => {
    try {
      return await present(serial);
    } catch (cause) {
      presenceCheckFailed = true;
      throw cause;
    }
  };

  async function run() {
    while (!stopped) {
      try {
        const ready = await waitForDevices(configs, {
          present: checkPresence,
          wait: pause,
          shouldStop: () => stopped,
          onMissing: () => {
            retry.reset();
            state = "waiting-for-sdrs";
          },
        });
        if (!ready) break;
        if (stopped) break;
        if (presenceCheckFailed) {
          retry.reset();
          presenceCheckFailed = false;
        }
        error = undefined;
        state = "starting";
        const processRun = startAirbandProcess({
          configPath,
          serials: [...new Set(configs.map(({ SDR_SERIAL }) => SDR_SERIAL))],
          log,
          spawnProcess,
          shutdownTimeoutMs,
          setTimeoutImpl,
          clearTimeoutImpl,
          onStarted: () => {
            state = "running";
            log.info("RTLSDR-Airband started");
          },
          onError: (cause) => {
            state = "error";
            error = cause.message;
          },
        });
        stopRunningProcess = processRun.stop;
        const result = await processRun.finished;
        stopRunningProcess = undefined;
        if (stopped) break;
        state = result.cause ? "error" : "waiting-for-sdrs";
        error = result.cause?.message ?? `RTLSDR-Airband exited (${result.code ?? result.signal})`;
        onError(new Error(error));
      } catch (cause) {
        state = "error";
        error = cause.message;
        onError(cause);
      }
      const retryDelay = retry.nextDelay();
      if (!stopped) await pause(retryDelay);
    }
  }

  const task = run();
  return {
    close: async () => {
      stopped = true;
      resolveStop();
      state = "stopped";
      stopRunningProcess?.();
      await task;
    },
    ready: () => state === "running",
    status: () => ({ state, error }),
  };
}
