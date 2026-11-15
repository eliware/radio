import { expect, jest, test } from "@jest/globals";
import { createBroadcastifyRetry } from "../../src/broadcastify/retry.mjs";

test("schedules restart callbacks with capped backoff and resets delay", () => {
  const timers = [];
  const retry = createBroadcastifyRetry({
    initialDelayMs: 10,
    maxDelayMs: 20,
    setTimeoutImpl: (callback, delay) => (timers.push({ callback, delay }), timers.length),
    clearTimeoutImpl: jest.fn(),
  });
  const callback = jest.fn();
  retry.schedule(callback);
  retry.schedule(callback);
  expect(timers.map(({ delay }) => delay)).toEqual([10]);
  timers[0].callback();
  expect(callback).toHaveBeenCalledTimes(1);
  retry.schedule(callback);
  expect(timers[1].delay).toBe(20);
  timers[1].callback();
  retry.reset();
  retry.schedule(callback);
  expect(timers[2].delay).toBe(10);
});

test("cancels a pending retry and tolerates an empty close", () => {
  const clearTimeoutImpl = jest.fn();
  const retry = createBroadcastifyRetry({
    setTimeoutImpl: () => 7,
    clearTimeoutImpl,
  });
  retry.close();
  retry.schedule(() => {});
  retry.close();
  expect(clearTimeoutImpl).toHaveBeenCalledWith(7);
});

test("uses default retry settings", () => {
  const retry = createBroadcastifyRetry();
  retry.reset();
  retry.close();
});
