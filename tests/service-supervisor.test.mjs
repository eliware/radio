import { EventEmitter } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { expect, jest, test } from "@jest/globals";
import { probeTcp, startServiceSupervisor } from "../src/service-supervisor.mjs";

function fakeSocket() {
  const socket = new EventEmitter();
  socket.setTimeout = jest.fn((duration, callback) => {
    socket.timeoutCallback = callback;
  });
  socket.destroy = jest.fn();
  return socket;
}

class FakeChild extends EventEmitter {
  exitCode = null;
  signals = [];

  kill(signal) {
    this.signals.push(signal);
    this.exitCode = 0;
    this.emit("close", 0, null);
  }
}

async function listen(app) {
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  return app.address().port;
}

function requestStatus(port, path) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: "localhost", port, path }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () =>
        resolve({ status: response.statusCode, json: () => JSON.parse(body) }),
      );
    });
    request.once("error", reject);
    request.end();
  });
}

test("probeTcp reports connection and timeout outcomes", async () => {
  const tcpServer = createServer();
  const tcpPort = await listen(tcpServer);
  await expect(probeTcp("localhost", tcpPort)).resolves.toBe(true);
  await new Promise((resolve) => tcpServer.close(resolve));

  const connectedSocket = fakeSocket();
  const connected = probeTcp("host", 8000, () => connectedSocket);
  connectedSocket.emit("connect");
  await expect(connected).resolves.toBe(true);
  expect(connectedSocket.destroy).toHaveBeenCalled();

  const timedSocket = fakeSocket();
  const timed = probeTcp("host", 8000, () => timedSocket);
  timedSocket.timeoutCallback();
  await expect(timed).resolves.toBe(false);

  const failedSocket = fakeSocket();
  const failed = probeTcp("host", 8000, () => failedSocket);
  failedSocket.emit("error", new Error("closed"));
  await expect(failed).resolves.toBe(false);
});

test("supervisor serves status routes and shuts down its child once", async () => {
  const child = new FakeChild();
  const service = await startServiceSupervisor({
    command: "radio-child",
    args: ["--run"],
    port: 0,
    spawnProcess: jest.fn(() => child),
  });
  const port = service.server.address().port;

  const health = await requestStatus(port, "/health");
  const ready = await requestStatus(port, "/ready");
  const missing = await requestStatus(port, "/unknown");
  expect(health.status).toBe(200);
  expect(ready.status).toBe(200);
  expect(missing.status).toBe(404);

  const firstClose = service.close();
  expect(service.close()).toBe(firstClose);
  await firstClose;
  expect(child.signals).toEqual(["SIGTERM"]);
});

test("readiness reports startup and downstream failures", async () => {
  const service = await startServiceSupervisor({
    port: 0,
    startupError: "Receiver configuration is invalid",
  });
  const port = service.server.address().port;
  const health = await requestStatus(port, "/health");
  const ready = await requestStatus(port, "/ready");
  expect(health.status).toBe(200);
  expect(ready.status).toBe(503);
  expect(ready.json()).toEqual({
    status: "Receiver configuration is invalid",
  });
  await service.close();

  const child = new FakeChild();
  const unavailable = await startServiceSupervisor({
    command: "radio-child",
    port: 0,
    readyCheck: async () => false,
    spawnProcess: () => child,
  });
  const downstream = await requestStatus(unavailable.server.address().port, "/ready");
  expect(downstream.status).toBe(503);
  await unavailable.close();
});

test("retries a child after an error or exit", async () => {
  const child = new FakeChild();
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const service = await startServiceSupervisor({
    command: "radio-child",
    port: 0,
    spawnProcess: () => child,
  });
  child.emit("error", new Error("spawn issue"));
  child.exitCode = 1;
  child.emit("close", 1, null);
  expect(log).toHaveBeenCalledWith("spawn issue");
  expect(log).toHaveBeenCalledWith("Child process exited (1). Retrying in 5 seconds.");
  await service.close();
  log.mockRestore();

  const spawnLog = jest.spyOn(console, "error").mockImplementation(() => {});
  const failed = await startServiceSupervisor({
    command: "radio-child",
    port: 0,
    spawnProcess: () => {
      throw new Error("spawn failed");
    },
  });
  expect(spawnLog).toHaveBeenCalledWith("spawn failed");
  await failed.close();
  spawnLog.mockRestore();
});

test("shutdown kills a child that does not exit after SIGTERM", async () => {
  jest.useFakeTimers();
  const child = new FakeChild();
  child.kill = jest.fn((signal) => child.signals.push(signal));
  const service = await startServiceSupervisor({
    command: "radio-child",
    port: 0,
    spawnProcess: () => child,
  });

  const closing = service.close();
  await jest.advanceTimersByTimeAsync(5000);
  await closing;
  expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
  jest.useRealTimers();
});

test("reports a port bind failure", async () => {
  const occupied = createServer();
  const port = await listen(occupied);
  await expect(startServiceSupervisor({ port })).rejects.toThrow();
  await new Promise((resolve) => occupied.close(resolve));
});
