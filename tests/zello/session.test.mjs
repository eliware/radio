import { EventEmitter } from "node:events";
import { generateKeyPairSync } from "node:crypto";
import { createZelloSession } from "../../src/zello/session.mjs";

class FakeSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  commands = [];
  binaries = [];
  rejectLogon = false;

  constructor() {
    super();
    queueMicrotask(() => {
      this.readyState = FakeSocket.OPEN;
      this.emit("open");
    });
  }

  send(value) {
    if (Buffer.isBuffer(value)) {
      this.binaries.push(value);
      return;
    }
    const command = JSON.parse(value);
    this.commands.push(command);
    const response = { seq: command.seq, success: true };
    if (command.command === "logon" && this.rejectLogon) {
      response.success = false;
      response.error = "rejected";
    }
    if (command.command === "start_stream") response.stream_id = 23;
    queueMicrotask(() => this.emit("message", Buffer.from(JSON.stringify(response))));
  }

  close() {
    this.readyState = FakeSocket.CLOSED;
    this.emit("close");
  }
  terminate() {
    this.close();
  }
}

test("logs in with a minted production token and streams Opus packets", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  let socket;
  class TestSocket extends FakeSocket {
    constructor(url) {
      super();
      this.url = url;
      socket = this;
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
  expect(session.healthy()).toBe(true);
  expect(socket.url).toBe("wss://zello.io/ws");
  expect(socket.commands[0].command).toBe("logon");
  expect(socket.commands[0].auth_token.split(".")).toHaveLength(3);
  const stream = await session.startStream();
  const header = Buffer.from(
    socket.commands.find((command) => command.command === "start_stream").codec_header,
    "base64",
  );
  expect(header.readUInt16LE(0)).toBe(48000);
  socket.readyState = 0;
  expect(() => session.sendAudio(stream, Buffer.from([1]))).toThrow("offline");
  socket.readyState = FakeSocket.OPEN;
  session.sendAudio(stream, Buffer.from([1, 2, 3]));
  await session.stopStream(stream);
  expect(socket.binaries[0].readUInt32BE(1)).toBe(23);
  expect(socket.commands.at(-1).command).toBe("stop_stream");
  const closed = session.waitForClose();
  session.close();
  await closed;
  expect(session.healthy()).toBe(false);
  await expect(session.waitForClose()).resolves.toBeUndefined();
});

test("closes a rejected login and handles socket errors", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  const config = {
    CHANNEL: "PD",
    USERNAME: "radio",
    PASSWORD: "pw",
    ISSUER: "issuer",
    PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }),
  };
  let rejectedSocket;
  class RejectSocket extends FakeSocket {
    constructor() {
      super();
      this.rejectLogon = true;
      rejectedSocket = this;
    }
  }
  const rejected = createZelloSession(config, RejectSocket);
  await expect(rejected.connect()).rejects.toThrow("rejected");
  expect(rejectedSocket.readyState).toBe(FakeSocket.CLOSED);

  let onlineSocket;
  class ErrorSocket extends FakeSocket {
    constructor() {
      super();
      onlineSocket = this;
    }
  }
  const session = createZelloSession(config, ErrorSocket);
  await session.connect();
  const closed = session.waitForClose();
  onlineSocket.emit("error", new Error("network error"));
  await closed;
  expect(session.healthy()).toBe(false);
  expect(() => session.sendAudio(1, Buffer.alloc(1))).toThrow("offline");
  const unused = createZelloSession(config);
  unused.close();
  expect(unused.healthy()).toBe(false);
});
