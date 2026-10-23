#!/usr/bin/env node
import { registerHandlers, registerSignals } from "@eliware/common";
import { errorDetails } from "../src/logging/error-details.mjs";
import { logger } from "../src/logger.mjs";
import { createRadioRuntime } from "../src/radio-runtime.mjs";
import { createStatusServer } from "../src/status-server.mjs";

let runtime;
let server;
const errors = registerHandlers({ log: logger });
const signals = registerSignals({
  log: logger,
  shutdownHook: async (signal) => {
    logger.info("Radio shutdown started", { signal });
    await runtime?.close();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    errors.removeHandlers();
    process.off("uncaughtException", fatal);
    process.off("unhandledRejection", fatal);
  },
});

function fatal() {
  process.exitCode = 1;
  void signals.shutdown("fatal process error").catch((error) => {
    logger.error("Fatal shutdown failure", { error: errorDetails(error) });
  });
}

process.on("uncaughtException", fatal);
process.on("unhandledRejection", fatal);

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
