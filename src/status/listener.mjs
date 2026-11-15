import { createStatusServer } from "./server.mjs";

export async function startStatusListener(
  runtime,
  {
    log,
    onServer,
    port = process.env.RADIO_HEALTH_PORT ?? 1400,
    createServer = createStatusServer,
  },
) {
  const listenPort = Number(port);
  const server = createServer(runtime, log);
  onServer(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, "0.0.0.0", resolve);
  });
  log.info("Radio service started", { port: listenPort });
  return server;
}
