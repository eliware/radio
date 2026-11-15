#!/usr/bin/env node
import { registerHandlers, registerSignals } from "@eliware/common";
import { logger } from "../src/logger.mjs";
import { createRadioRuntime } from "../src/radio/runtime.mjs";
import { registerRadioShutdown } from "../src/radio-shutdown.mjs";
import { startStatusListener } from "../src/status/listener.mjs";

let runtime;
let server;
const shutdown = registerRadioShutdown({
  processImpl: process,
  registerHandlersImpl: registerHandlers,
  registerSignalsImpl: registerSignals,
  getRuntime: () => runtime,
  getServer: () => server,
  log: logger,
});

try {
  runtime = await createRadioRuntime({ log: logger });
  await startStatusListener(runtime, { log: logger, onServer: (instance) => (server = instance) });
} catch (error) {
  await shutdown.startupFailed(error);
}
