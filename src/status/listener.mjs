import { createStatusServer } from "./server.mjs";

export function readStatusPort(value = process.env.RADIO_HEALTH_PORT ?? 1400) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("RADIO_HEALTH_PORT must be an integer from 0 to 65535");
  return port;
}

export async function startStatusListener(
  runtime,
  { log, onServer, port, createServer = createStatusServer },
) {
  const listenPort = readStatusPort(port);
  const server = createServer(runtime, log);
  onServer(server);
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(listenPort, "0.0.0.0", resolve);
    });
  } catch (error) {
    server.close(() => {});
    throw error;
  }
  log.info("Radio service started", { port: listenPort });
  return server;
}
