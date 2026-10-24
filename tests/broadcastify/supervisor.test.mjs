import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createBroadcastifySupervisor } from "../../src/broadcastify/supervisor.mjs";

function childProcess() {
  const child = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), { end: jest.fn() });
  child.stderr = new EventEmitter();
  child.kill = jest.fn();
  return child;
}

test("starts FFmpeg, resets stable retry state, retries exits, and closes cleanly", () => {
  const children = [childProcess(), childProcess()];
  const timers = [];
  const cleared = [];
  const onError = jest.fn();
  const spawnProcess = jest.fn(() => children.shift());
  const supervisor = createBroadcastifySupervisor(
    { enabled: true, name: "Fire", password: "private", mount: "/mount" },
    {
      spawnProcess,
      onError,
      setTimeoutImpl: (callback, ms) => {
        const timer = { callback, ms };
        timers.push(timer);
        return timer;
      },
      clearTimeoutImpl: (timer) => cleared.push(timer),
    },
  );
  expect(supervisor.ready()).toBe(true);
  expect(supervisor.status()).toEqual({ state: "running" });
  supervisor.child.stdin.emit("error", new Error("stdin failed"));
  expect(onError).toHaveBeenCalledWith(new Error("Broadcastify audio pipe failed"));
  const stable = timers.find((timer) => timer.ms === 60000);
  stable.callback();
  const first = spawnProcess.mock.results[0].value;
  first.stderr.emit("data", "Connection to icecast://source:private@host.example/mount failed");
  first.emit("close", 1, null);
  expect(onError).toHaveBeenCalledWith(
    new Error("Fire FFmpeg exited (code 1: Connection to icecast://[redacted] failed)"),
  );
  expect(supervisor.status()).toEqual({ state: "retrying" });
  const retry = timers.find((timer) => timer.ms === 1000);
  retry.callback();
  const second = spawnProcess.mock.results[1].value;
  supervisor.close();
  expect(second.stdin.end).toHaveBeenCalled();
  expect(second.kill).toHaveBeenCalledWith("SIGTERM");
  expect(supervisor.status()).toEqual({ state: "closed" });
  expect(cleared.length).toBeGreaterThan(0);
  second.emit("error", new Error("late failure"));
  second.emit("close", 1);
});

test("reports process errors once and retries after the current child closes", () => {
  const children = [childProcess(), childProcess()];
  const timers = [];
  const onError = jest.fn();
  const supervisor = createBroadcastifySupervisor(
    { enabled: true },
    {
      spawnProcess: () => children.shift(),
      onError,
      setTimeoutImpl: (callback, ms) => {
        const timer = { callback, ms };
        timers.push(timer);
        return timer;
      },
      clearTimeoutImpl: jest.fn(),
    },
  );
  const first = supervisor.child;
  first.emit("error", new Error("spawn failed"));
  first.emit("close", 1);
  expect(onError).toHaveBeenCalledTimes(1);
  timers.find((timer) => timer.ms === 1000).callback();
  expect(supervisor.child).toBeDefined();
  supervisor.close();
});

test("reports signal exits when FFmpeg has no stderr output", () => {
  const child = childProcess();
  const onError = jest.fn();
  const supervisor = createBroadcastifySupervisor(
    { enabled: true },
    { spawnProcess: () => child, onError },
  );
  child.emit("close", null, "SIGKILL");
  expect(onError).toHaveBeenCalledWith(new Error("Broadcastify FFmpeg exited (SIGKILL)"));
  supervisor.close();
});

test("recovers from synchronous spawn failure and accepts a disabled configuration", () => {
  const timers = [];
  const supervisor = createBroadcastifySupervisor(
    { enabled: true },
    {
      spawnProcess: () => {
        throw new Error("missing executable");
      },
      setTimeoutImpl: (callback) => {
        timers.push(callback);
        return timers.length;
      },
      clearTimeoutImpl: jest.fn(),
    },
  );
  expect(supervisor.ready()).toBe(false);
  timers[0]();
  supervisor.close();
  timers[1]();
  const disabled = createBroadcastifySupervisor({ enabled: false });
  expect(disabled.ready()).toBe(true);
  expect(disabled.status()).toEqual({ state: "disabled" });
  disabled.close();
});
