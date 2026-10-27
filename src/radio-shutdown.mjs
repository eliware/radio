import { errorDetails } from "./logging/error-details.mjs";

export function registerRadioShutdown({
  processImpl,
  registerHandlersImpl,
  registerSignalsImpl,
  getRuntime,
  getServer,
  log,
}) {
  const errors = registerHandlersImpl({ log });
  let signals;

  function fatal() {
    processImpl.exitCode = 1;
    void signals.shutdown("fatal process error").catch((error) => {
      log.error("Fatal shutdown failure", { error: errorDetails(error) });
    });
  }

  signals = registerSignalsImpl({
    log,
    shutdownHook: async (signal) => {
      log.info("Radio shutdown started", { signal });
      await getRuntime()?.close();
      const server = getServer();
      if (server?.listening) await new Promise((resolve) => server.close(resolve));
      errors.removeHandlers();
      processImpl.off("uncaughtException", fatal);
      processImpl.off("unhandledRejection", fatal);
    },
  });

  processImpl.on("uncaughtException", fatal);
  processImpl.on("unhandledRejection", fatal);
  return signals;
}
