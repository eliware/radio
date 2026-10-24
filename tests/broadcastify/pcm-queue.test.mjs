import { expect, jest, test } from "@jest/globals";
import { createPcmQueue } from "../../src/broadcastify/pcm-queue.mjs";

test("drops odd PCM, returns silence when empty, and drains queued audio", () => {
  const queue = createPcmQueue(jest.fn());
  expect(queue.next()).toHaveLength(960);
  queue.write(Buffer.from([1]));
  expect(queue.next()).toHaveLength(960);
  const audio = Buffer.alloc(4, 1);
  queue.write(audio);
  expect(queue.next()).toBe(audio);
  expect(queue.next()).toHaveLength(960);
});

test("caps queued audio and reports congestion once until space is available", () => {
  const onError = jest.fn();
  const queue = createPcmQueue(onError);
  queue.write(Buffer.alloc(96000));
  queue.write(Buffer.alloc(960));
  queue.write(Buffer.alloc(960));
  expect(onError).toHaveBeenCalledTimes(1);
  queue.write(Buffer.alloc(96000));
  expect(onError).toHaveBeenCalledTimes(1);
  expect(queue.next()).toHaveLength(960);
  queue.write(Buffer.alloc(96000));
  expect(onError).toHaveBeenCalledTimes(2);
  queue.clear();
  expect(queue.next()).toHaveLength(960);
});
