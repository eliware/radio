import { spawn } from "node:child_process";
import { logger as defaultLogger } from "./logger.mjs";
import { hasUsbSerial } from "./usb-device.mjs";

export function createAirbandSupervisor({
  configs,
  configPath,
  initialReady,
  wait,
  onError,
  log = defaultLogger,
  present = hasUsbSerial,
  spawnProcess = spawn,
}) {
  let stopped = false;
  let child;
  let state = "waiting-for-zello";
  let error;
  let resolveStop;
  const stopSignal = new Promise((resolve) => {
    resolveStop = resolve;
  });
  const pause = (ms) => Promise.race([wait(ms), stopSignal]);

  async function run() {
    await initialReady;
    let delay = 1000;
    while (!stopped) {
      const detected = await Promise.all(configs.map(({ SDR_SERIAL }) => present(SDR_SERIAL)));
      if (stopped) break;
      if (!detected.every(Boolean)) {
        state = "waiting-for-sdrs";
        await pause(2000);
        continue;
      }
      try {
        error = undefined;
        state = "starting";
        log.info("Starting RTLSDR-Airband", {
          serials: configs.map(({ SDR_SERIAL }) => SDR_SERIAL),
        });
        child = spawnProcess("rtl_airband", ["-F", "-e", "-c", configPath], {
          stdio: "inherit",
        });
        const result = await new Promise((resolve) => {
          child.once("spawn", () => {
            state = "running";
            log.info("RTLSDR-Airband started");
          });
          child.once("error", (cause) => resolve({ cause }));
          child.once("close", (code, signal) => resolve({ code, signal }));
        });
        child = undefined;
        if (stopped) break;
        state = "waiting-for-sdrs";
        error = result.cause?.message ?? `RTLSDR-Airband exited (${result.code ?? result.signal})`;
        onError(new Error(error));
      } catch (cause) {
        child = undefined;
        state = "error";
        error = cause.message;
        onError(cause);
      }
      if (!stopped) await pause(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }

  const task = run();
  return {
    close: async () => {
      stopped = true;
      resolveStop();
      state = "stopped";
      child?.kill("SIGTERM");
      await task;
    },
    ready: () => state === "running",
    status: () => ({ state, error }),
  };
}
