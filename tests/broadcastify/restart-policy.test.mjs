import { expect, jest, test } from "@jest/globals";
import createBroadcastifyRestartPolicy from "../../src/broadcastify/restart-policy.mjs";

test("schedules retries and resets backoff after a stable process", () => {
  const timers = [];
  const cleared = [];
  const policy = createBroadcastifyRestartPolicy({
    setTimeoutImpl: (callback, ms) => (timers.push({ callback, ms }), timers.length),
    clearTimeoutImpl: (timer) => cleared.push(timer),
  });
  const start = jest.fn();
  policy.schedule(start);
  expect(timers[0].ms).toBe(1000);
  timers[0].callback();
  expect(start).toHaveBeenCalledTimes(1);
  policy.observe(60000);
  timers[1].callback();
  policy.schedule(start);
  expect(timers[2].ms).toBe(1000);
  policy.cancelStability();
  policy.close();
  expect(cleared).toContain(3);
});

test("closes a pending retry timer", () => {
  const clearTimeoutImpl = jest.fn();
  const policy = createBroadcastifyRestartPolicy({
    setTimeoutImpl: () => 1,
    clearTimeoutImpl,
  });
  policy.schedule(() => {});
  policy.close();
  expect(clearTimeoutImpl).toHaveBeenCalledWith(1);
});
