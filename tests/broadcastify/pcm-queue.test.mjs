import { expect, jest, test } from "@jest/globals";
import { createPcmQueue } from "../../src/broadcastify/pcm-queue.mjs";

test("returns silence when empty and drains queued PCM in order", () => {
  const queue = createPcmQueue(jest.fn());
  expect(queue.next()).toEqual(Buffer.alloc(960));
  queue.write(Buffer.from([1]));
  expect(queue.next()).toEqual(Buffer.alloc(960));
  const first = Buffer.alloc(960, 1);
  const second = Buffer.alloc(960, 2);
  queue.write(first);
  queue.write(second);
  expect(queue.next()).toBe(first);
  expect(queue.next()).toBe(second);
});

test("bounds long audio backlogs and reports congestion once until drained", () => {
  const onError = jest.fn();
  const queue = createPcmQueue(onError);
  queue.write(Buffer.alloc(200000));
  queue.write(Buffer.alloc(500000));
  queue.next();
  queue.clear();
  const longFrame = Buffer.alloc(960000);
  queue.write(longFrame);
  queue.write(Buffer.alloc(960, 1));
  queue.write(longFrame);
  queue.write(Buffer.alloc(960, 2));
  expect(onError).toHaveBeenCalledTimes(1);
  expect(queue.next()).toHaveLength(960);
  expect(queue.next()).toHaveLength(960);
  queue.write(longFrame);
  queue.write(Buffer.alloc(960));
  expect(onError).toHaveBeenCalledTimes(2);
  queue.clear();
  expect(queue.next()).toEqual(Buffer.alloc(960));
});
