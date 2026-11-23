import { spawn } from "node:child_process";
import { logger as defaultLogger } from "./logger.mjs";
import { hasUsbSerial } from "./usb/device.mjs";
import waitForAirbandDevices from "./airband/device-monitor.mjs";
import startAirbandProcess from "./airband/process.mjs";
import createAirbandProcessSupervision from "./airband/supervision.mjs";

export default function createAirbandSupervisor({
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
  const supervision = createAirbandProcessSupervision({
    configs,
    wait,
    onError,
    log,
    present,
    waitForDevices,
    startProcess: (callbacks) =>
      startAirbandProcess({
        ...callbacks,
        configPath,
        serials: [...new Set(configs.map(({ SDR_SERIAL }) => SDR_SERIAL))],
        log,
        spawnProcess,
        shutdownTimeoutMs,
        setTimeoutImpl,
        clearTimeoutImpl,
      }),
  });
  return {
    close: supervision.close,
    ready: supervision.ready,
    status: supervision.status,
  };
}
