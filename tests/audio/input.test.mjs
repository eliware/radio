import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createAudioInput } from "../../src/audio/input.mjs";

const rnnoise = {
  frameSize: 480,
  createDenoiseState: () => ({ processFrame: () => 0, destroy: () => {} }),
};

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
    if (!this.bound) throw new Error("ERR_SOCKET_DGRAM_NOT_RUNNING");
    this.closed = true;
  }
}

test("binds UDP input and forwards packet and error events", async () => {
  const socket = new FakeSocket();
  const receive = jest.fn();
  const closeTransmission = jest.fn();
  const onError = jest.fn();
  const input = createAudioInput({
    port: 12001,
    session: {},
    rnnoise,
    onError,
    createSocketImpl: () => socket,
    createTransmissionImpl: () => ({ receive, close: closeTransmission }),
  });

  await expect(input.listen()).resolves.toBe(12001);
  const packet = Buffer.alloc(32);
  socket.emit("message", packet);
  socket.emit("error", new Error("socket failed"));
  await input.close();

  expect(receive).toHaveBeenCalledWith(packet);
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "socket failed" }));
  expect(closeTransmission).toHaveBeenCalledTimes(1);
  expect(socket.closed).toBe(true);
});

test("opens the default loopback UDP input and closes an idle transmission", async () => {
  const input = createAudioInput({
    port: 0,
    rnnoise,
    session: { healthy: () => false },
  });
  expect(await input.listen()).toBeGreaterThan(0);
  await input.close();
});

test("uses the default socket error handler", async () => {
  const socket = new FakeSocket();
  const input = createAudioInput({
    port: 12001,
    session: {},
    rnnoise,
    createSocketImpl: () => socket,
    createTransmissionImpl: () => ({ receive: () => {}, close: async () => {} }),
  });
  await input.listen();
  socket.emit("error", new Error("handled by default"));
  await input.close();
});

test("rejects UDP bind errors and reports them", async () => {
  class FailedBindSocket extends FakeSocket {
    bind() {
      this.emit("error", new Error("bind failed"));
    }
  }
  const onError = jest.fn();
  const input = createAudioInput({
    port: 12001,
    session: {},
    rnnoise,
    onError,
    createSocketImpl: () => new FailedBindSocket(),
    createTransmissionImpl: () => ({ receive: () => {}, close: async () => {} }),
  });
  await expect(input.listen()).rejects.toThrow("bind failed");
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "bind failed" }));
  await expect(input.close()).resolves.toBeUndefined();
});

test("rejects synchronous UDP bind failures", async () => {
  class ThrowingBindSocket extends FakeSocket {
    bind() {
      throw new Error("invalid bind");
    }
  }
  const input = createAudioInput({
    port: 12001,
    session: {},
    rnnoise,
    createSocketImpl: () => new ThrowingBindSocket(),
    createTransmissionImpl: () => ({ receive: () => {}, close: async () => {} }),
  });
  await expect(input.listen()).rejects.toThrow("invalid bind");
  await input.close();
});
