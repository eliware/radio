import { EventEmitter } from "node:events";
import { generateKeyPairSync } from "node:crypto";
import { expect, jest, test } from "@jest/globals";
import listenForZelloResponses from "../../src/zello/responses.mjs";
import createZelloSession from "../../src/zello/session.mjs";

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

test("logs sanitized command errors once per minute when diagnostics are enabled", () => {
  const socket = new EventEmitter();
  const log = { warn: jest.fn() };
  let now = 60000;
  const waiting = new Map();
  for (let seq = 1; seq <= 3; seq += 1)
    waiting.set(seq, {
      resolve: jest.fn(),
      reject: jest.fn(),
      timer: undefined,
      command: "stop_stream",
      channel: "PD",
    });
  waiting.set(4, {
    resolve: jest.fn(),
    reject: jest.fn(),
    timer: undefined,
  });
  listenForZelloResponses(
    socket,
    () => true,
    waiting,
    undefined,
    true,
    log,
    () => now,
  );

  for (const seq of [1, 2])
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ seq, error: "invalid stream id", password: "private" })),
    );
  expect(log.warn).toHaveBeenCalledTimes(1);
  expect(log.warn.mock.calls[0][1]).toMatchObject({ command: "stop_stream", channel: "PD" });
  expect(JSON.stringify(log.warn.mock.calls[0][1])).not.toContain("private");

  now += 60000;
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 3, error: "invalid stream id" })));
  expect(log.warn).toHaveBeenCalledTimes(2);
  expect(log.warn.mock.calls[1][1].channel).toBe("PD");

  socket.emit("message", Buffer.from(JSON.stringify({ seq: 4, error: "denied" })));
  expect(log.warn).toHaveBeenCalledTimes(3);
  expect(log.warn.mock.calls[2][1]).toMatchObject({ command: "unknown" });
  expect(log.warn.mock.calls[2][1]).not.toHaveProperty("channel");
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

test("reports three invalid matching responses within ten seconds", () => {
  const socket = new EventEmitter();
  const invalid = jest.fn();
  const waiting = new Map();
  for (let seq = 1; seq <= 3; seq += 1)
    waiting.set(seq, {
      resolve: jest.fn(),
      reject: jest.fn(),
      timer: undefined,
      command: "start_stream",
    });
  const remove = listenForZelloResponses(socket, () => true, waiting, invalid);
  for (let seq = 1; seq <= 3; seq += 1)
    socket.emit("message", Buffer.from(JSON.stringify({ seq, success: "yes" })));
  expect(invalid).toHaveBeenCalledTimes(1);
  expect(invalid.mock.calls[0][0].message).toContain(
    "Received 3 invalid Zello responses in 10 seconds",
  );
  expect(invalid.mock.calls[0][0].message).toContain('"command":"start_stream"');
  expect(invalid.mock.calls[0][0].message).toContain('"success":"string"');
  remove();
});

test("reports response field types without logging response values", () => {
  const socket = new EventEmitter();
  const invalid = jest.fn();
  const waiting = new Map();
  for (let seq = 1; seq <= 3; seq += 1)
    waiting.set(seq, { resolve: jest.fn(), reject: jest.fn(), timer: undefined, command: "logon" });
  listenForZelloResponses(socket, () => true, waiting, invalid);
  for (let seq = 1; seq <= 3; seq += 1) {
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          seq,
          success: "secret-value",
          password: "private",
          optional: null,
          items: [],
        }),
      ),
    );
  }
  const message = invalid.mock.calls[0][0].message;
  expect(message).toContain('"password":"string"');
  expect(message).toContain('"success":"string"');
  expect(message).toContain('"optional":"null"');
  expect(message).toContain('"items":"array"');
  expect(message).not.toContain("secret-value");
  expect(message).not.toContain("private");
});

test("includes sanitized response values when diagnostics are enabled", () => {
  const socket = new EventEmitter();
  const invalid = jest.fn();
  const waiting = new Map();
  for (let seq = 1; seq <= 3; seq += 1)
    waiting.set(seq, { resolve: jest.fn(), reject: jest.fn(), timer: undefined, command: "logon" });
  listenForZelloResponses(socket, () => true, waiting, invalid, true);
  for (let seq = 1; seq <= 3; seq += 1) {
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ seq, success: "unexpected", password: "private" })),
    );
  }
  const message = invalid.mock.calls[0][0].message;
  expect(message).toContain('"success":"unexpected"');
  expect(message).not.toContain('"password":"private"');
  expect(message).not.toContain("private");
});

test("closes a Zello session after repeated invalid command responses", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  let socket;
  class TestSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;
    commands = [];
    constructor() {
      super();
      socket = this;
      queueMicrotask(() => {
        this.readyState = TestSocket.OPEN;
        this.emit("open");
      });
    }
    send(value) {
      const command = JSON.parse(value);
      this.commands.push(command);
      if (command.command === "logon")
        queueMicrotask(() =>
          this.emit("message", Buffer.from(JSON.stringify({ seq: command.seq, success: true }))),
        );
    }
    close() {
      this.readyState = TestSocket.CLOSED;
      this.emit("close");
    }
  }
  const session = createZelloSession(
    {
      CHANNEL: "PD",
      USERNAME: "radio",
      PASSWORD: "pw",
      ISSUER: "issuer",
      PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }),
    },
    TestSocket,
  );
  await session.connect();
  const requests = [session.startStream(), session.startStream(), session.startStream()];
  for (const { seq } of socket.commands.slice(1))
    socket.emit("message", Buffer.from(JSON.stringify({ seq, success: "yes" })));
  const error = await session.waitForClose();
  expect(error.message).toContain("3 invalid Zello responses");
  expect(session.healthy()).toBe(false);
  await expect(Promise.allSettled(requests)).resolves.toHaveLength(3);
});
