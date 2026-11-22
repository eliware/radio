import { expect, jest, test } from "@jest/globals";
import createBroadcastifyStability from "../../src/broadcastify/stability.mjs";

test("calls the stable handler after the configured interval", () => {
  let timer;
  const onStable = jest.fn();
  const stability = createBroadcastifyStability({
    onStable,
    setTimeoutImpl: (callback, duration) => ((timer = { callback, duration }), 1),
    clearTimeoutImpl: jest.fn(),
  });
  stability.observe(60000);
  expect(timer.duration).toBe(60000);
  timer.callback();
  expect(onStable).toHaveBeenCalledTimes(1);
  stability.close();
});

test("replaces and cancels stable timers and tolerates empty cancellation", () => {
  const timers = [];
  const clearTimeoutImpl = jest.fn();
  const stability = createBroadcastifyStability({
    onStable: jest.fn(),
    setTimeoutImpl: (callback) => (timers.push(callback), timers.length),
    clearTimeoutImpl,
  });
  stability.cancel();
  stability.observe(10);
  stability.observe(20);
  expect(clearTimeoutImpl).toHaveBeenCalledWith(1);
  stability.cancel();
  stability.cancel();
  expect(clearTimeoutImpl).toHaveBeenCalledWith(2);
  stability.observe(30);
  stability.close();
  expect(clearTimeoutImpl).toHaveBeenCalledWith(3);
});
