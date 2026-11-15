import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { shutdownBroadcastifyProcess } from "../../src/broadcastify/shutdown.mjs";

function childProcess(kill) {
  const process = new EventEmitter();
  process.stdin = { end: jest.fn() };
  process.kill = kill;
  return process;
}

test("sends SIGTERM and resolves when the process closes", async () => {
  const timers = [];
  const clearTimeoutImpl = jest.fn();
  let process;
  process = childProcess(
    jest.fn((signal) => {
      if (signal === "SIGTERM") process.emit("close");
    }),
  );
  const closing = shutdownBroadcastifyProcess(process, {
    setTimeoutImpl: (callback, ms) => (timers.push({ callback, ms }), 1),
    clearTimeoutImpl,
    timeoutMs: 5000,
  });
  await closing;
  expect(process.stdin.end).toHaveBeenCalledTimes(1);
  expect(process.kill).toHaveBeenCalledWith("SIGTERM");
  expect(timers[0].ms).toBe(5000);
  expect(clearTimeoutImpl).toHaveBeenCalledWith(1);
  timers[0].callback();
});

test("supports a timer implementation without a handle", async () => {
  const process = childProcess((signal) => {
    if (signal === "SIGTERM") process.emit("close");
  });
  const clearTimeoutImpl = jest.fn();
  await shutdownBroadcastifyProcess(process, {
    setTimeoutImpl: () => undefined,
    clearTimeoutImpl,
    timeoutMs: 1,
  });
  expect(clearTimeoutImpl).not.toHaveBeenCalled();
});

test("force kills a process that does not close after SIGTERM", async () => {
  const timers = [];
  const process = childProcess(jest.fn());
  const closing = shutdownBroadcastifyProcess(process, {
    setTimeoutImpl: (callback) => (timers.push(callback), 2),
    clearTimeoutImpl: jest.fn(),
    timeoutMs: 1,
  });
  timers[0]();
  await closing;
  expect(process.kill).toHaveBeenNthCalledWith(1, "SIGTERM");
  expect(process.kill).toHaveBeenNthCalledWith(2, "SIGKILL");
});
