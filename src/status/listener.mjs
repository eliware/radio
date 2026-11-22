import createStatusServer from "./server.mjs";
import readStatusPort from "./read-port.mjs";

export default async function startStatusListener(
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
