#!/usr/bin/env node
import { createRadioServer, parsePort } from "../src/server.mjs";

try {
  const port = parsePort(process.env.PORT ?? "3000");
  const app = await createRadioServer();
  await app.listen({ host: "0.0.0.0", port });
  console.info(`Radio web server listening on port ${port}`);
  let shutdownPromise;
  const shutdown = () =>
    (shutdownPromise ??= app.close().catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    }));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
