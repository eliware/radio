import { createServer } from "node:http";
import { logger as defaultLogger } from "./logger.mjs";

export function createStatusServer(runtime, log = defaultLogger) {
  return createServer((request, response) => {
    const health = request.url === "/health";
    const ready = request.url === "/ready";
    if (!health && !ready) return response.writeHead(404).end();
    const isReady = runtime.ready();
    log.debug("Status endpoint requested", { route: request.url, ready: isReady });
    response.writeHead(ready && !isReady ? 503 : 200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        status: health ? "ok" : isReady ? "ready" : "not-ready",
        ...runtime.status(),
      }),
    );
  });
}
