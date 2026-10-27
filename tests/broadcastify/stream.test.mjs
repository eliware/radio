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
      getChild: () => child,
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
  expect(child.stdin.write).toHaveBeenCalledTimes(3);
});

test("keeps disabled output inert", () => {
  const stream = createBroadcastifyStream({ enabled: false });
  stream.write(Buffer.alloc(960));
  stream.close();
});

test("clears queued audio if no child is available", () => {
  let pump;
  const stream = createBroadcastifyStream(
    { enabled: true },
    {
      setIntervalImpl: (callback) => ((pump = callback), 1),
      clearIntervalImpl: jest.fn(),
    },
  );
  stream.write(Buffer.alloc(960, 1));
  pump();
  stream.close();
});

test("drops queued PCM while the FFmpeg child is unavailable", () => {
  const child = childProcess();
  let available;
  const { stream, pump } = makeStream(child, {
    getChild: () => available,
  });
  const audio = Buffer.alloc(960, 1);
  stream.write(audio);
  pump();
  available = child;
  pump();
  expect(child.stdin.write).toHaveBeenCalledWith(Buffer.alloc(960));
  expect(child.stdin.write).not.toHaveBeenCalledWith(audio);
  stream.close();
});

test("uses the default error callback when an enabled stream write throws", () => {
  const child = childProcess();
  const { stream, pump } = makeStream(child);
  child.stdin.write.mockImplementation(() => {
    throw new Error("pipe error");
  });
  stream.write(Buffer.alloc(960));
  expect(() => pump()).not.toThrow();
  stream.close();
});
