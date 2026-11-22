import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import listenForZelloResponses from "../../src/zello/responses.mjs";

test("ignores malformed and unknown responses and settles matching commands", async () => {
  const socket = new EventEmitter();
  const resolve = jest.fn();
  const reject = jest.fn();
  const waiting = new Map([
    [1, { resolve, reject, timer: undefined }],
    [2, { resolve: jest.fn(), reject: jest.fn(), timer: undefined }],
  ]);
  listenForZelloResponses(socket, () => true, waiting);
  socket.emit("message", Buffer.from("invalid"));
  for (const value of [null, [], "response"]) {
    socket.emit("message", Buffer.from(JSON.stringify(value)));
  }
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 99, success: true })));
  socket.emit("message", Buffer.from(JSON.stringify({ seq: "not-numeric", success: true })));
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 1.5, success: true })));
  socket.emit("message", Buffer.from(JSON.stringify({ seq: true, success: true })));
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 1, success: true })));
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 2, success: false })));
  expect(resolve).toHaveBeenCalledWith({ seq: 1, success: true });
  expect(waiting.has(1)).toBe(false);
  expect(waiting.has(2)).toBe(false);
  expect(waiting.size).toBe(0);
});

test("rejects failed responses and ignores messages from an inactive socket", async () => {
  const socket = new EventEmitter();
  const reject = jest.fn();
  const waiting = new Map([[3, { resolve: jest.fn(), reject, timer: undefined }]]);
  let active = false;
  listenForZelloResponses(socket, () => active, waiting);
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 3, success: false, error: "denied" })));
  expect(waiting.has(3)).toBe(true);
  active = true;
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 3, success: false, error: "denied" })));
  expect(reject).toHaveBeenCalledWith(new Error("denied"));
  expect(waiting.has(3)).toBe(false);
});
test("uses the default failure message when the response has no error", () => {
  const socket = new EventEmitter();
  const reject = jest.fn();
  const waiting = new Map([[4, { resolve: jest.fn(), reject, timer: undefined }]]);
  listenForZelloResponses(socket, () => true, waiting);
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 4, success: false })));
  expect(reject).toHaveBeenCalledWith(new Error("Zello request failed"));
});

test("rejects matching responses whose success flag is not boolean", () => {
  const socket = new EventEmitter();
  const reject = jest.fn();
  const waiting = new Map([[5, { resolve: jest.fn(), reject, timer: undefined }]]);
  listenForZelloResponses(socket, () => true, waiting);
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 5, success: "yes" })));
  expect(reject).toHaveBeenCalledWith(new Error("Invalid Zello response"));
  expect(waiting.has(5)).toBe(false);
});

test("matches numeric-string response sequence identifiers", () => {
  const socket = new EventEmitter();
  const resolve = jest.fn();
  const waiting = new Map([[6, { resolve, reject: jest.fn(), timer: undefined }]]);
  listenForZelloResponses(socket, () => true, waiting);
  socket.emit("message", Buffer.from(JSON.stringify({ seq: "6", success: true })));
  expect(resolve).toHaveBeenCalledWith({ seq: "6", success: true });
  expect(waiting.has(6)).toBe(false);
});
