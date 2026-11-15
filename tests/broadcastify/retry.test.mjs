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

test("resets retry state after stability and cancels that timer when unstable", () => {
  const timers = [];
  const clearTimeoutImpl = jest.fn();
  const retry = createBroadcastifyRetry({
    initialDelayMs: 10,
    setTimeoutImpl: (callback, delay) => (timers.push({ callback, delay }), timers.length),
    clearTimeoutImpl,
  });
  const callback = jest.fn();
  retry.schedule(callback);
  timers[0].callback();
  retry.schedule(callback);
  expect(timers[1].delay).toBe(20);
  timers[1].callback();
  retry.resetAfterStable(60);
  expect(timers[2].delay).toBe(60);
  retry.resetAfterStable(70);
  timers[3].callback();
  retry.schedule(callback);
  expect(timers[4].delay).toBe(10);
  retry.resetAfterStable(60);
  retry.cancelStableReset();
  retry.cancelStableReset();
  retry.close();
  retry.resetAfterStable(80);
  retry.close();
  expect(clearTimeoutImpl).toHaveBeenCalledWith(3);
  expect(clearTimeoutImpl).toHaveBeenCalledWith(6);
  expect(clearTimeoutImpl).toHaveBeenCalledWith(5);
  expect(clearTimeoutImpl).toHaveBeenCalledWith(7);
});
