#!/usr/bin/env node
import { registerHandlers, registerSignals } from "@eliware/common";
import { logger } from "../src/logger.mjs";
import { createRadioRuntime } from "../src/radio/runtime.mjs";
import { registerRadioShutdown } from "../src/radio-shutdown.mjs";
import { createStatusServer } from "../src/status/server.mjs";

let runtime;
let server;
registerRadioShutdown({
  processImpl: process,
  registerHandlersImpl: registerHandlers,
  registerSignalsImpl: registerSignals,
  getRuntime: () => runtime,
  getServer: () => server,
  log: logger,
});

try {
  runtime = await createRadioRuntime({ log: logger });
  server = createStatusServer(runtime, logger);
  const port = Number(process.env.RADIO_HEALTH_PORT ?? 1400);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });
  logger.info("Radio service started", { port });
} catch (error) {
  process.exitCode = 1;
  logger.error("Radio service startup failed", { error: errorDetails(error) });
  await signals.shutdown("startup failure");
}
