import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createBroadcastifyStream } from "../../src/broadcastify/stream.mjs";

function childProcess() {
  const child = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), {
    writable: true,
    writableLength: 0,
    write: jest.fn(),
    end: jest.fn(),
  });
  child.kill = jest.fn(() => child.emit("close", null, "SIGTERM"));
  return child;
}

function makeStream(child, options = {}) {
  let pump;
  const stream = createBroadcastifyStream(
    { enabled: true },
    {
      spawnProcess: () => child,
      setIntervalImpl: (callback) => ((pump = callback), 1),
      clearIntervalImpl: jest.fn(),
      ...options,
    },
  );
  return { stream, pump: () => pump() };
}

test("sends silence continuously and preserves queued PCM during pipe pressure", () => {
  const child = childProcess();
  const onError = jest.fn();
  const { stream, pump } = makeStream(child, { onError });
  const pcm = Buffer.alloc(960, 1);
  pump();
  expect(child.stdin.write).toHaveBeenLastCalledWith(Buffer.alloc(960));
  stream.write(pcm);
  pump();
  expect(child.stdin.write).toHaveBeenLastCalledWith(pcm);
  child.stdin.writableLength = 96001;
  stream.write(pcm);
  pump();
  pump();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(child.stdin.write).toHaveBeenCalledTimes(2);
  child.stdin.writableLength = 0;
  child.stdin.write.mockImplementationOnce(() => {
    throw new Error("broken pipe");
  });
  pump();
  expect(onError).toHaveBeenCalledTimes(2);
  child.stdin.writable = false;
  stream.write(pcm);
  pump();
  expect(child.stdin.write).toHaveBeenCalledTimes(3);
  stream.close();
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
});

test("keeps disabled output inert", () => {
  const stream = createBroadcastifyStream({ enabled: false });
  stream.write(Buffer.alloc(960));
  expect(stream.ready()).toBe(true);
  expect(stream.status()).toEqual({ state: "disabled" });
  stream.close();
});

test("clears queued PCM while FFmpeg is restarting", () => {
  const child = childProcess();
  const timers = [];
  let starts = 0;
  const { stream, pump } = makeStream(child, {
    spawnProcess: () => {
      starts += 1;
      if (starts === 1) throw new Error("not installed");
      return child;
    },
    setTimeoutImpl: (callback) => (timers.push(callback), timers.length),
  });
  const audio = Buffer.alloc(960, 1);
  stream.write(audio);
  pump();
  timers[0]();
  pump();
  expect(child.stdin.write).toHaveBeenCalledWith(Buffer.alloc(960));
  expect(child.stdin.write).not.toHaveBeenCalledWith(audio);
  stream.close();
});

test("uses the default error callback when an enabled stream write throws", () => {
  const child = childProcess();
  child.stdin.write.mockImplementation(() => {
    throw new Error("pipe error");
  });
  const { stream, pump } = makeStream(child);
  stream.write(Buffer.alloc(960));
  expect(() => pump()).not.toThrow();
  stream.close();
});
