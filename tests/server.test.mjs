import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createRadioServer, parsePort } from "../src/server.mjs";

test("serves health and readiness status", async () => {
  const app = await createRadioServer();

  await expect(app.inject({ method: "GET", url: "/health" })).resolves.toMatchObject({
    statusCode: 200,
    payload: JSON.stringify({ status: "ok" }),
  });
  await expect(app.inject({ method: "GET", url: "/ready" })).resolves.toMatchObject({
    statusCode: 200,
    payload: JSON.stringify({ status: "ready" }),
  });
  await app.close();
});

test("serves the basic status page and browser bundle", async () => {
  const app = await createRadioServer();
  const page = await app.inject({ method: "GET", url: "/" });
  const bundle = await app.inject({ method: "GET", url: "/client.js" });

  expect(page.statusCode).toBe(200);
  expect(page.body).toContain("<h1>Radio</h1>");
  expect(bundle.statusCode).toBe(200);
  await app.close();
});

test.each(["3000", 8080, "65535"])("accepts valid port %s", (value) => {
  expect(parsePort(value)).toBe(Number(value));
});

test.each(["0", "65536", "abc", "1.5"])("rejects invalid port %s", (value) => {
  expect(() => parsePort(value)).toThrow("PORT must be an integer from 1 through 65535");
});

function mockServer() {
  const routes = new Map();
  return {
    routes,
    get: (path, handler) => routes.set(path, handler),
    register: async () => {},
  };
}

function mockReply() {
  const events = new Map();
  const reply = {
    code: jest.fn(() => reply),
    send: jest.fn(),
    hijack: jest.fn(),
    raw: {
      headersSent: false,
      writeHead: jest.fn(function () {
        this.headersSent = true;
      }),
      end: jest.fn(),
      on: jest.fn((event, callback) => events.set(event, callback)),
    },
  };
  return { reply, events };
}

async function createTestServer(requestStream, fetcher = fetch) {
  const app = mockServer();
  await createRadioServer({
    fastifyFactory: () => app,
    staticPlugin: async () => {},
    icecastHost: "icecast-test",
    icecastPort: 8100,
    requestStream,
    fetcher,
  });
  return app;
}

test("reports per-channel receiver state and unavailable status", async () => {
  const app = await createTestServer(
    () => {},
    async () => ({
      ok: true,
      json: async () => ({ police: { state: "running" }, fire: { state: "disconnected" } }),
    }),
  );
  const status = app.routes.get("/channels");
  await expect(status({}, mockReply().reply)).resolves.toEqual({
    police: { state: "running" },
    fire: { state: "disconnected" },
  });
  const rejected = await createTestServer(
    () => {},
    async () => ({ ok: false }),
  );
  const rejectedReply = mockReply().reply;
  await rejected.routes.get("/channels")({}, rejectedReply);
  expect(rejectedReply.code).toHaveBeenCalledWith(503);
  expect(rejectedReply.send).toHaveBeenCalled();
  const unavailable = await createTestServer(
    () => {},
    async () => {
      throw new Error("receiver service down");
    },
  );
  const errorReply = mockReply().reply;
  await expect(unavailable.routes.get("/channels")({}, errorReply)).resolves.toBeUndefined();
  expect(errorReply.code).toHaveBeenCalledWith(503);
  expect(errorReply.send).toHaveBeenCalledWith({
    police: { state: "unavailable" },
    fire: { state: "unavailable" },
  });
});

test("proxies selected audio streams and releases them on client close", async () => {
  const upstream = new EventEmitter();
  upstream.end = jest.fn(() =>
    upstream.onResponse({
      statusCode: 206,
      headers: { "content-type": "audio/mpeg" },
      pipe: jest.fn(),
    }),
  );
  upstream.destroy = jest.fn();
  const requestStream = jest.fn((options, callback) => {
    upstream.onResponse = callback;
    return upstream;
  });
  const app = await createTestServer(requestStream);
  const { reply, events } = mockReply();
  const handler = app.routes.get("/streams/:channel.mp3");

  handler({ params: { channel: "fire" } }, reply);

  expect(requestStream).toHaveBeenCalledWith(
    { hostname: "icecast-test", port: 8100, path: "/fire.mp3" },
    expect.any(Function),
  );
  expect(reply.hijack).toHaveBeenCalled();
  expect(reply.raw.writeHead).toHaveBeenCalledWith(206, { "content-type": "audio/mpeg" });
  events.get("close")();
  expect(upstream.destroy).toHaveBeenCalled();
});

test("uses a gateway status when the upstream omits its status code", async () => {
  const upstream = new EventEmitter();
  upstream.end = jest.fn(() => upstream.onResponse({ headers: {}, pipe: jest.fn() }));
  upstream.destroy = jest.fn();
  const app = await createTestServer((options, callback) => {
    upstream.onResponse = callback;
    return upstream;
  });
  const { reply } = mockReply();
  app.routes.get("/streams/:channel.mp3")({ params: { channel: "police" } }, reply);
  expect(reply.raw.writeHead).toHaveBeenCalledWith(502, {});
});

test("rejects unknown channels and uses a gateway error when Icecast is down", async () => {
  const app = await createTestServer(() => {
    const request = new EventEmitter();
    request.end = jest.fn();
    request.destroy = jest.fn();
    return request;
  });
  const handler = app.routes.get("/streams/:channel.mp3");
  const invalid = mockReply();
  handler({ params: { channel: "weather" } }, invalid.reply);
  expect(invalid.reply.code).toHaveBeenCalledWith(404);
  expect(invalid.reply.send).toHaveBeenCalled();

  const offline = mockReply();
  const request = new EventEmitter();
  request.end = jest.fn();
  request.destroy = jest.fn();
  const offlineApp = await createTestServer(() => request);
  offlineApp.routes.get("/streams/:channel.mp3")({ params: { channel: "police" } }, offline.reply);
  request.emit("error", new Error("Icecast unavailable"));
  expect(offline.reply.raw.writeHead).toHaveBeenCalledWith(502);
  expect(offline.reply.raw.end).toHaveBeenCalled();
});

test("ends a stream after upstream failure once headers were sent", async () => {
  const request = new EventEmitter();
  request.end = jest.fn();
  request.destroy = jest.fn();
  const app = await createTestServer(() => request);
  const { reply } = mockReply();
  reply.raw.headersSent = true;
  app.routes.get("/streams/:channel.mp3")({ params: { channel: "police" } }, reply);
  request.emit("error", new Error("stream ended"));
  expect(reply.raw.writeHead).not.toHaveBeenCalled();
  expect(reply.raw.end).toHaveBeenCalled();
});
