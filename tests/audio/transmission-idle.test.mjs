import { expect, jest, test } from "@jest/globals";
import { createTransmissionIdle } from "../../src/audio/transmission-idle.mjs";

test("ends transmission after idle time and reports end failures", async () => {
  let now = 0;
  let timerCallback;
  const end = jest.fn(async () => {});
  const onError = jest.fn();
  const idle = createTransmissionIdle({
    idleMs: 10,
    now: () => now,
    setTimeoutImpl: (callback) => ((timerCallback = callback), 1),
    clearTimeoutImpl: () => {},
    end,
    onError,
  });

  idle.recordActivity();
  idle.schedule();
  timerCallback();
  await Promise.resolve();
  expect(end).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();

  end.mockRejectedValueOnce(new Error("end failed"));
  idle.schedule();
  timerCallback();
  await Promise.resolve();
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "end failed" }));

  now = 10;
  expect(idle.isIdle()).toBe(true);
});
