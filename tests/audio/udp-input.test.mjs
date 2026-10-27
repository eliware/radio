import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createUdpInput } from "../../src/audio/udp-input.mjs";

class FakeSocket extends EventEmitter {
  bind(port, _host, callback) {
    this.port = port || 12001;
    this.bound = true;
    callback();
  }
  address() {
    return { port: this.port };
  }
  close() {
    if (!this.bound) {
      const error = new Error("socket is not running");
      error.code = "ERR_SOCKET_DGRAM_NOT_RUNNING";
      throw error;
    }
    this.closed = true;
  }
}

test("binds UDP to loopback and forwards packet and error events", async () => {
  const socket = new FakeSocket();
  const onMessage = jest.fn();
  const onError = jest.fn();
  const input = createUdpInput({
    port: 12001,
    onMessage,
    onError,
    createSocketImpl: jest.fn(() => socket),
  });

  await expect(input.listen()).resolves.toBe(12001);
  const packet = Buffer.alloc(32);
  socket.emit("message", packet);
  socket.emit("error", new Error("socket failed"));
  input.close();

  expect(onMessage).toHaveBeenCalledWith(packet);
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "socket failed" }));
  expect(socket.closed).toBe(true);
});

test("binds an ephemeral localhost port and closes before a bind", async () => {
  const input = createUdpInput({ port: 0, onMessage: () => {} });
  expect(await input.listen()).toBeGreaterThan(0);
  input.close();

  const idle = createUdpInput({
    port: 12001,
    onMessage: () => {},
    createSocketImpl: () => new FakeSocket(),
  });
  expect(() => idle.close()).not.toThrow();
});

test("uses the default socket error handler", () => {
  const socket = new FakeSocket();
  const input = createUdpInput({
    port: 12001,
    onMessage: () => {},
    createSocketImpl: () => socket,
  });
  expect(() => socket.emit("error", new Error("handled by default"))).not.toThrow();
  input.close();
});

test("rejects asynchronous and synchronous UDP bind errors", async () => {
  class FailedBindSocket extends FakeSocket {
    bind() {
      this.emit("error", new Error("bind failed"));
    }
  }
  const onError = jest.fn();
  const failed = createUdpInput({
    port: 12001,
    onMessage: () => {},
    onError,
    createSocketImpl: () => new FailedBindSocket(),
  });
  await expect(failed.listen()).rejects.toThrow("bind failed");
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "bind failed" }));
  failed.close();

  class ThrowingBindSocket extends FakeSocket {
    bind() {
      throw new Error("invalid bind");
    }
  }
  const throwing = createUdpInput({
    port: 12001,
    onMessage: () => {},
    createSocketImpl: () => new ThrowingBindSocket(),
  });
  await expect(throwing.listen()).rejects.toThrow("invalid bind");
  throwing.close();
});

test("propagates unexpected UDP close errors", async () => {
  class FailedCloseSocket extends FakeSocket {
    close() {
      const error = new Error("close failed");
      error.code = "EIO";
      throw error;
    }
  }
  const input = createUdpInput({
    port: 12001,
    onMessage: () => {},
    createSocketImpl: () => new FailedCloseSocket(),
  });
  await input.listen();
  expect(() => input.close()).toThrow("close failed");
});
