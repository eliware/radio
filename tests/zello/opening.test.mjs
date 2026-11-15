import { EventEmitter } from "node:events";
import { expect, test } from "@jest/globals";
import { createZelloOpening } from "../../src/zello/opening.mjs";

class Socket extends EventEmitter {
  static CLOSED = 3;
  readyState = 0;
}

test("resolves the opening promise and waits for socket close", async () => {
  const socket = new Socket();
  const opening = createZelloOpening(socket, Socket.CLOSED);
  socket.emit("open");
  await opening.opening;
  const closed = opening.waitForClose();
  socket.readyState = Socket.CLOSED;
  socket.emit("close");
  await closed;
  await expect(opening.waitForClose()).resolves.toBeUndefined();
});

test("rejects opening errors and removes its temporary listeners", async () => {
  const socket = new Socket();
  const opening = createZelloOpening(socket, Socket.CLOSED);
  const error = new Error("opening failed");
  socket.emit("error", error);
  await expect(opening.opening).rejects.toBe(error);
  expect(socket.listenerCount("open")).toBe(0);
  expect(socket.listenerCount("error")).toBe(0);
});

test("rejects close-before-open and resolves close waiters", async () => {
  const socket = new Socket();
  const opening = createZelloOpening(socket, Socket.CLOSED);
  socket.readyState = Socket.CLOSED;
  socket.emit("close");
  await expect(opening.opening).rejects.toThrow("Zello closed before connecting");
  await expect(opening.waitForClose()).resolves.toBeUndefined();
});
