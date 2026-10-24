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
  child.kill = jest.fn();
  return child;
}

test("pumps PCM to FFmpeg and handles pipe pressure and write failures", () => {
  const child = childProcess();
  const onError = jest.fn();
  let pump;
  const stream = createBroadcastifyStream(
    { enabled: true },
    {
      spawnProcess: () => child,
      onError,
      setIntervalImpl: (callback) => {
        pump = callback;
        return 1;
      },
      clearIntervalImpl: jest.fn(),
    },
  );
  const pcm = Buffer.alloc(960);
  stream.write(pcm);
  pump();
  expect(child.stdin.write).toHaveBeenCalledWith(pcm);
  child.stdin.writableLength = 96001;
  stream.write(pcm);
  pump();
  pump();
  expect(onError).toHaveBeenCalledTimes(1);
  child.stdin.writableLength = 0;
  child.stdin.write.mockImplementationOnce(() => {
    throw new Error("broken pipe");
  });
  stream.write(pcm);
  pump();
  expect(onError).toHaveBeenCalledTimes(2);
  child.stdin.writable = false;
  stream.write(pcm);
  pump();
  stream.close();
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
});

test("keeps disabled output inert and clears its timer on close", () => {
  const stream = createBroadcastifyStream({ enabled: false });
  stream.write(Buffer.alloc(960));
  expect(stream.ready()).toBe(true);
  expect(stream.status()).toEqual({ state: "disabled" });
  stream.close();
});

test("drops queued PCM while the supervisor has no child", () => {
  const child = childProcess();
  const timeouts = [];
  let pump;
  let starts = 0;
  const stream = createBroadcastifyStream(
    { enabled: true },
    {
      spawnProcess: () => {
        starts += 1;
        if (starts === 1) throw new Error("not installed");
        return child;
      },
      setTimeoutImpl: (callback) => {
        timeouts.push(callback);
        return timeouts.length;
      },
      clearTimeoutImpl: jest.fn(),
      setIntervalImpl: (callback) => {
        pump = callback;
        return 1;
      },
    },
  );
  const audio = Buffer.alloc(960, 1);
  stream.write(audio);
  pump();
  timeouts[0]();
  pump();
  expect(child.stdin.write).not.toHaveBeenCalledWith(audio);
  stream.close();
});

test("uses the default error callback when an enabled stream write throws", () => {
  const child = childProcess();
  child.stdin.write.mockImplementation(() => {
    throw new Error("pipe error");
  });
  let pump;
  const stream = createBroadcastifyStream(
    { enabled: true },
    { spawnProcess: () => child, setIntervalImpl: (callback) => ((pump = callback), 1) },
  );
  stream.write(Buffer.alloc(960));
  expect(() => pump()).not.toThrow();
  stream.close();
});
