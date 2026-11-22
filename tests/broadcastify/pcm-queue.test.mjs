import { expect, test } from "@jest/globals";
import createPcmQueue from "../../src/broadcastify/pcm-queue.mjs";

test("returns silence when empty and drains queued PCM in order", () => {
  const queue = createPcmQueue();
  expect(queue.next()).toEqual(Buffer.alloc(960));
  for (let count = 0; count < 1000; count += 1) queue.write(Buffer.alloc(0));
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

test("discards the oldest packet and tracks stored bytes", () => {
  const queue = createPcmQueue();
  expect(queue.discardOldest()).toBeUndefined();
  const first = Buffer.alloc(960, 1);
  const second = Buffer.alloc(960, 2);
  queue.write(first);
  queue.write(second);
  expect(queue.queuedBytes).toBe(1920);
  expect(queue.discardOldest()).toBe(first);
  expect(queue.queuedBytes).toBe(960);
  expect(queue.next()).toBe(second);
  expect(queue.queuedBytes).toBe(0);
});
