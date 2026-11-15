import { expect, jest, test } from "@jest/globals";
import { createBroadcastifyStreamPump } from "../../src/broadcastify/pump.mjs";

test("clears the queue while the child is unavailable and cancels its timer", () => {
  let tick;
  const timer = { id: 9 };
  const queue = { next: jest.fn(), clear: jest.fn() };
  const clearIntervalImpl = jest.fn();
  const pump = createBroadcastifyStreamPump({
    queue,
    getChild: () => undefined,
    onError: jest.fn(),
    setIntervalImpl: (callback, ms) => ((tick = callback), expect(ms).toBe(10), timer),
    clearIntervalImpl,
  });
  tick();
  expect(queue.clear).toHaveBeenCalledTimes(1);
  expect(queue.next).not.toHaveBeenCalled();
  pump.close();
  expect(clearIntervalImpl).toHaveBeenCalledWith(timer);
});

test("keeps queued PCM while the pipe pump has a child", () => {
  let tick;
  const queue = { next: jest.fn(() => Buffer.alloc(960)), clear: jest.fn() };
  const child = { stdin: { writable: true, writableLength: 0, write: jest.fn() } };
  const pump = createBroadcastifyStreamPump({
    queue,
    getChild: () => child,
    onError: jest.fn(),
    setIntervalImpl: (callback) => ((tick = callback), 1),
    clearIntervalImpl: jest.fn(),
  });
  tick();
  expect(queue.clear).not.toHaveBeenCalled();
  expect(child.stdin.write).toHaveBeenCalledWith(Buffer.alloc(960));
  pump.close();
});
