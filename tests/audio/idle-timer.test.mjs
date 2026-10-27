import { expect, jest, test } from "@jest/globals";
import { createAudioIdleTimer } from "../../src/audio/idle-timer.mjs";

test("tracks activity, schedules idle work, and cancels timers", () => {
  let now = 0;
  let nextTimer = 0;
  const callbacks = new Map();
  const cleared = [];
  const onIdle = jest.fn();
  const idle = createAudioIdleTimer({
    idleMs: 10,
    now: () => now,
    setTimeoutImpl: (callback) => {
      nextTimer += 1;
      callbacks.set(nextTimer, callback);
      return nextTimer;
    },
    clearTimeoutImpl: (timer) => cleared.push(timer),
    onIdle,
  });

  expect(idle.isIdle()).toBe(false);
  idle.recordActivity();
  expect(idle.isIdle()).toBe(false);
  now = 10;
  expect(idle.isIdle()).toBe(true);
  expect(idle.isIdle(true)).toBe(true);
  idle.schedule();
  idle.schedule();
  expect(cleared).toEqual([1]);
  callbacks.get(2)();
  expect(onIdle).toHaveBeenCalledTimes(1);
  idle.reset();
  idle.schedule();
  idle.cancel();
  idle.cancel();
  expect(cleared).toEqual([1, 3]);
});
