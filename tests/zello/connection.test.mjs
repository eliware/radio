import { EventEmitter } from "node:events";
import { jest } from "@jest/globals";
import { createZelloConnection } from "../../src/zello/connection.mjs";

class FakeSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0;
  close = jest.fn(() => {
    this.readyState = FakeSocket.CLOSED;
    this.emit("close");
  });
  terminate = jest.fn(() => this.close());

  constructor(url) {
    super();
    this.url = url;
  }
}

test("opens the Zello endpoint and resolves when the socket closes", async () => {
  let socket;
  class TestSocket extends FakeSocket {
    constructor(url) {
      super(url);
      socket = this;
    }
  }
  const onClose = jest.fn();
  const connection = createZelloConnection(TestSocket, { onClose });
  expect(socket.url).toBe("wss://zello.io/ws");
  socket.readyState = FakeSocket.OPEN;
  socket.emit("open");
  await connection.opening;
  const closed = connection.waitForClose();
  connection.close();
  await closed;
  expect(onClose).toHaveBeenCalledTimes(1);
  await expect(connection.waitForClose()).resolves.toBeUndefined();
});

test("rejects opening errors and terminates sockets when supported", async () => {
  let socket;
  class FailingSocket extends FakeSocket {
    constructor(url) {
      super(url);
      socket = this;
    }
  }
  const error = new Error("opening failed");
  const onError = jest.fn();
  const connection = createZelloConnection(FailingSocket, { onError });
  socket.emit("error", error);
  await expect(connection.opening).rejects.toBe(error);
  expect(onError).toHaveBeenCalledWith(error);
  expect(socket.terminate).toHaveBeenCalledTimes(1);
});

test("rejects a close before open", async () => {
  let socket;
  class ClosingSocket extends FakeSocket {
    constructor(url) {
      super(url);
      socket = this;
    }
  }
  const onClose = jest.fn();
  const connection = createZelloConnection(ClosingSocket, { onClose });
  socket.close();
  await expect(connection.opening).rejects.toThrow("Zello closed before connecting");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("closes on socket errors when terminate is unavailable", async () => {
  let socket;
  class CloseOnlySocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 0;
    close = jest.fn(() => {
      this.readyState = CloseOnlySocket.CLOSED;
      this.emit("close");
    });

    constructor(url) {
      super();
      this.url = url;
      socket = this;
    }
  }
  const onError = jest.fn();
  const connection = createZelloConnection(CloseOnlySocket, { onError });
  socket.readyState = CloseOnlySocket.OPEN;
  socket.emit("open");
  await connection.opening;
  const closed = connection.waitForClose();
  const error = new Error("network error");
  socket.emit("error", error);
  await closed;
  expect(onError).toHaveBeenCalledWith(error);
  expect(socket.close).toHaveBeenCalledTimes(1);
});

test("does not close an already closed socket again after an error", async () => {
  let socket;
  class CloseOnlySocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = CloseOnlySocket.CLOSED;
    close = jest.fn(() => {
      this.emit("error", new Error("recursive error"));
    });

    constructor(url) {
      super();
      this.url = url;
      socket = this;
    }
  }
  const onError = jest.fn();
  const connection = createZelloConnection(CloseOnlySocket, { onError });
  connection.opening.catch(() => {});
  socket.emit("error", new Error("socket error"));
  expect(socket.close).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledTimes(1);
});

test("uses optional lifecycle callbacks when they are omitted", async () => {
  let socket;
  class TestSocket extends FakeSocket {
    constructor(url) {
      super(url);
      socket = this;
    }
  }
  const connection = createZelloConnection(TestSocket);
  socket.readyState = FakeSocket.OPEN;
  socket.emit("open");
  await connection.opening;
  const closed = connection.waitForClose();
  socket.emit("error", new Error("optional handler"));
  await closed;
});
