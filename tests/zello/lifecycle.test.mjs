import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import createZelloLifecycle from "../../src/zello/lifecycle.mjs";

class Socket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;

  constructor() {
    super();
    queueMicrotask(() => {
      this.readyState = Socket.OPEN;
      this.emit("open");
    });
  }

  close() {
    this.readyState = Socket.CLOSED;
    this.emit("close");
  }

  terminate() {
    this.close();
  }
}

test("tracks socket connection, online state, close, and disconnection", async () => {
  const lifecycle = createZelloLifecycle(Socket);
  const disconnected = jest.fn();
  const connection = lifecycle.connect(disconnected);
  await connection.opening;
  connection.setOnline();
  expect(lifecycle.healthy()).toBe(true);
  expect(connection.isCurrent()).toBe(true);
  const closed = lifecycle.waitForClose();
  lifecycle.close();
  await closed;
  expect(lifecycle.healthy()).toBe(false);
  expect(disconnected).toHaveBeenCalledWith(new Error("Zello socket closed"));
});

test("replacement invalidates stale connection state and supports empty shutdown", async () => {
  const lifecycle = createZelloLifecycle(Socket);
  const first = lifecycle.connect(jest.fn());
  await first.opening;
  first.setOnline();
  const second = lifecycle.connect(jest.fn());
  expect(lifecycle.healthy()).toBe(false);
  first.setOnline();
  expect(lifecycle.healthy()).toBe(false);
  await second.opening;
  second.setOnline();
  expect(second.isCurrent()).toBe(true);
  expect(lifecycle.healthy()).toBe(true);
  lifecycle.close();

  const empty = createZelloLifecycle(Socket);
  expect(empty.healthy()).toBe(false);
  await expect(empty.waitForClose()).resolves.toBeUndefined();
  empty.close();
});

test("ignores close and error events from a replaced socket", async () => {
  class DelayedSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;

    close() {}
  }

  const lifecycle = createZelloLifecycle(DelayedSocket);
  const oldDisconnected = jest.fn();
  const old = lifecycle.connect(oldDisconnected);
  old.socket.readyState = DelayedSocket.OPEN;
  old.socket.emit("open");
  await old.opening;
  const current = lifecycle.connect(jest.fn());
  current.socket.readyState = DelayedSocket.OPEN;
  current.socket.emit("open");
  await current.opening;
  current.setOnline();

  old.socket.readyState = DelayedSocket.CLOSED;
  old.socket.emit("close");
  old.socket.emit("error", new Error("stale socket error"));

  expect(oldDisconnected).not.toHaveBeenCalled();
  expect(lifecycle.healthy()).toBe(true);
  lifecycle.close();
});
