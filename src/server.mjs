import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";

export async function createRadioServer({
  fastifyFactory = Fastify,
  staticPlugin = fastifyStatic,
  publicRoot = resolve("public"),
  buildRoot = resolve("dist"),
} = {}) {
  const app = fastifyFactory({ logger: false });
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async () => ({ status: "ready" }));
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
