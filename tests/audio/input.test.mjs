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
    callback();
  }
  address() {
    return { port: this.port };
  }
  close() {
    this.closed = true;
  }
}

test("routes CTCSS-gated UDP audio into one Zello stream and closes after silence", async () => {
  jest.useFakeTimers();
  const sent = [];
  const events = [];
  const socket = new FakeSocket();
  const session = {
    healthy: () => true,
    startStream: async () => {
      events.push("start");
      return 4;
    },
    sendAudio: (id, packet) => sent.push([id, packet]),
    stopStream: async (id) => events.push(`stop:${id}`),
  };
  const input = createAudioInput({
    port: 12001,
    session,
    rnnoise,
    idleMs: 30,
    createSocketImpl: () => socket,
  });
  await input.listen();
  for (let i = 0; i < 4; i += 1) socket.emit("message", Buffer.alloc(1280));
  await jest.advanceTimersByTimeAsync(30);
  await input.close();
  jest.useRealTimers();
  expect(events).toEqual(["start", "stop:4"]);
  expect(sent.length).toBeGreaterThan(0);
  expect(sent[0][0]).toBe(4);
  expect(socket.closed).toBe(true);
});

test("drops buffered audio if the Zello session disconnects during stream startup", async () => {
  jest.useFakeTimers();
  let healthy = true;
  let finishStart;
  const socket = new FakeSocket();
  const input = createAudioInput({
    port: 12001,
    rnnoise,
    session: {
      healthy: () => healthy,
      startStream: () => new Promise((resolve) => (finishStart = resolve)),
      sendAudio: () => {},
      stopStream: async () => {},
    },
    createSocketImpl: () => socket,
  });
  await input.listen();
  socket.emit("message", Buffer.alloc(1280));
  socket.emit("message", Buffer.alloc(1280));
  healthy = false;
  finishStart(4);
  await input.close();
  socket.emit("message", Buffer.alloc(1280));
  jest.useRealTimers();
  expect(socket.closed).toBe(true);
});

test("uses standard UDP input settings and closes with no transmission", async () => {
  jest.useFakeTimers();
  let now = 100;
  const socket = new FakeSocket();
  const input = createAudioInput({
    port: 12001,
    rnnoise,
    idleMs: 30,
    session: { healthy: () => true, startStream: async () => 2, stopStream: async () => {} },
    createSocketImpl: () => socket,
    now: () => now,
  });
  await input.listen();
  socket.emit("message", Buffer.alloc(1280));
  await jest.advanceTimersByTimeAsync(30);
  now = 200;
  await input.close();
  socket.emit("error", new Error("ignored by default handler"));
  jest.useRealTimers();
  expect(input).toHaveProperty("listen");
});

test("reports audio processor write failures", async () => {
  const onError = jest.fn();
  const socket = new FakeSocket();
  const input = createAudioInput({
    port: 12001,
    rnnoise,
    session: { healthy: () => true, startStream: async () => 8, stopStream: async () => {} },
    onError,
    createProcessor: () => ({
      write: () => {
        throw new Error("processor failed");
      },
      finishTransmission: () => {},
      close: () => {},
    }),
    createSocketImpl: () => socket,
  });
  await input.listen();
  socket.emit("message", Buffer.alloc(1280));
  await new Promise((resolve) => setImmediate(resolve));
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "processor failed" }));
  await input.close();
});

test("opens the default loopback UDP input when no factory is injected", async () => {
  const input = createAudioInput({
    port: 0,
    rnnoise,
    session: { healthy: () => false },
    createSocketImpl: undefined,
  });
  expect(await input.listen()).toBeGreaterThan(0);
  await input.close();
});

test("keeps a stream open when new audio arrives during startup", async () => {
  jest.useFakeTimers();
  let now = 0;
  let finishStart;
  const socket = new FakeSocket();
  const input = createAudioInput({
    port: 12001,
    rnnoise,
    idleMs: 30,
    session: {
      healthy: () => true,
      startStream: () => new Promise((resolve) => (finishStart = resolve)),
      sendAudio: () => {},
      stopStream: async () => {},
    },
    createSocketImpl: () => socket,
    now: () => now,
  });
  await input.listen();
  socket.emit("message", Buffer.alloc(1280));
  now = 30;
  jest.advanceTimersByTime(30);
  now = 30;
  socket.emit("message", Buffer.alloc(1280));
  finishStart(4);
  for (let attempt = 0; attempt < 5; attempt += 1) await Promise.resolve();
  await jest.advanceTimersByTimeAsync(1);
  now = 60;
  await input.close();
  jest.useRealTimers();
  expect(socket.closed).toBe(true);
});
