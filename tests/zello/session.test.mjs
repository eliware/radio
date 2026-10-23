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

test("logs in with a minted production token and manages session lifecycle", async () => {
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
  await expect(session.startStream()).resolves.toBe(23);
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

test("rejects a websocket error before open so the supervisor can retry", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  class FailingSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;

    constructor() {
      super();
      queueMicrotask(() => this.emit("error", new Error("opening failed")));
    }

    terminate() {
      this.readyState = FailingSocket.CLOSED;
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
    FailingSocket,
  );
  await expect(session.connect()).rejects.toThrow("opening failed");
  expect(session.healthy()).toBe(false);
});

test("closes a failed websocket when terminate is unavailable", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  let failedSocket;
  class CloseOnlySocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;

    constructor() {
      super();
      failedSocket = this;
      queueMicrotask(() => this.emit("error", new Error("opening failed")));
    }

    close() {
      this.readyState = CloseOnlySocket.CLOSED;
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
    CloseOnlySocket,
  );
  await expect(session.connect()).rejects.toThrow("opening failed");
  expect(failedSocket.readyState).toBe(CloseOnlySocket.CLOSED);
});

test("rejects a websocket close before open", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  class ClosingSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;

    constructor() {
      super();
      queueMicrotask(() => this.emit("close"));
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
    ClosingSocket,
  );
  await expect(session.connect()).rejects.toThrow("closed before connecting");
});
