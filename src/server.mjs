import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import { request as httpRequest } from "node:http";

export async function createRadioServer({
  fastifyFactory = Fastify,
  staticPlugin = fastifyStatic,
  publicRoot = resolve("public"),
  buildRoot = resolve("dist"),
  icecastHost = process.env.ICECAST_HOST ?? "icecast",
  icecastPort = Number(process.env.ICECAST_PORT ?? 8000),
  requestStream = httpRequest,
} = {}) {
  const app = fastifyFactory({ logger: false });
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async () => ({ status: "ready" }));
  app.get("/streams/:channel.mp3", (request, reply) => {
    const { channel } = request.params;
    if (!["police", "fire"].includes(channel)) return reply.code(404).send();
    reply.hijack();
    const upstream = requestStream(
      { hostname: icecastHost, port: icecastPort, path: `/${channel}.mp3` },
      (response) => {
        reply.raw.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(reply.raw);
      },
    );
    upstream.on("error", () => {
      if (!reply.raw.headersSent) reply.raw.writeHead(502);
      reply.raw.end();
    });
    reply.raw.on("close", () => upstream.destroy());
    upstream.end();
  });
  await app.register(staticPlugin, { root: [publicRoot, buildRoot] });
  return app;
}

export function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 through 65535");
  }
  return port;
}
