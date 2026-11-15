import { expect, jest, test } from "@jest/globals";
import { createPcmQueue } from "../../src/broadcastify/pcm-queue.mjs";
import { createPcmCongestionPolicy } from "../../src/broadcastify/congestion.mjs";

test("bounds the backlog, reports congestion once, and resets after draining", () => {
  const onError = jest.fn();
  const queue = createPcmCongestionPolicy(createPcmQueue(), onError, 1920);
  queue.write(Buffer.alloc(1920, 1));
  queue.write(Buffer.alloc(960, 2));
  queue.write(Buffer.alloc(1920, 3));
  expect(onError).toHaveBeenCalledTimes(1);
  expect(queue.next()).toEqual(Buffer.alloc(1920, 3));
  queue.write(Buffer.alloc(2880, 4));
  expect(onError).toHaveBeenCalledTimes(2);
  queue.clear();
  expect(queue.next()).toEqual(Buffer.alloc(960));

  const largeQueue = createPcmCongestionPolicy(createPcmQueue(), jest.fn(), 3840);
  for (let index = 0; index < 4; index += 1) largeQueue.write(Buffer.alloc(960));
  expect(largeQueue.next()).toHaveLength(960);
  largeQueue.clear();
});
