import { createServer } from "node:http";
import { logger as defaultLogger } from "../logger.mjs";
import { createStatusResponse } from "./response.mjs";

export function createStatusServer(runtime, log = defaultLogger) {
  return createServer((request, response) => {
    const health = request.url === "/health";
    const ready = request.url === "/ready";
    if (!health && !ready) return response.writeHead(404).end();
    if (request.method !== "GET") return response.writeHead(405, { Allow: "GET" }).end();
    const isReady = runtime.ready();
    log.debug("Status endpoint requested", { route: request.url, ready: isReady });
    const result = createStatusResponse(request.url, isReady, runtime.status());
    response.writeHead(result.statusCode, result.headers).end(result.body);
  });
}
