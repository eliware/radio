import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createBroadcastifySupervisor } from "../../src/broadcastify/supervisor.mjs";

function childProcess() {
  const child = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), { end: jest.fn(), writable: true });
  child.stderr = new EventEmitter();
  child.kill = jest.fn(() => child.emit("close", null, "SIGTERM"));
  return child;
}

test("starts FFmpeg, resets stable retry state, retries exits, and closes cleanly", async () => {
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
  expect(supervisor.ready()).toBe(false);
  expect(supervisor.status()).toEqual({ state: "connecting" });
  supervisor.child.emit("spawn");
  expect(supervisor.ready()).toBe(true);
  expect(supervisor.status()).toEqual({ state: "running" });
  supervisor.child.stdin.writable = false;
  expect(supervisor.ready()).toBe(false);
  supervisor.child.stdin.writable = true;
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
  second.emit("spawn");
  await supervisor.close();
  expect(second.stdin.end).toHaveBeenCalled();
  expect(second.kill).toHaveBeenCalledWith("SIGTERM");
  expect(supervisor.status()).toEqual({ state: "closed" });
  expect(cleared.length).toBeGreaterThan(0);
  second.emit("spawn");
  second.emit("error", new Error("late failure"));
  second.emit("close", 1);
});

test("reports process errors once and retries after the current child closes", async () => {
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
  await supervisor.close();
});

test("ignores a stale child close after its retry has started a replacement", async () => {
  const oldChild = childProcess();
  const newChild = childProcess();
  const timers = [];
  const supervisor = createBroadcastifySupervisor(
    { enabled: true },
    {
      spawnProcess: jest.fn().mockReturnValueOnce(oldChild).mockReturnValueOnce(newChild),
      setTimeoutImpl: (callback, ms) => (timers.push({ callback, ms }), timers.length),
      clearTimeoutImpl: jest.fn(),
    },
  );
  oldChild.emit("error", new Error("spawn failed"));
  timers.find(({ ms }) => ms === 1000).callback();
  expect(supervisor.child).toBe(newChild);
  oldChild.emit("close", 1);
  expect(supervisor.child).toBe(newChild);
  expect(supervisor.status()).toEqual({ state: "connecting" });
  await supervisor.close();
});

test("reports signal exits when FFmpeg has no stderr output", async () => {
  const child = childProcess();
  const onError = jest.fn();
  const supervisor = createBroadcastifySupervisor(
    { enabled: true },
    { spawnProcess: () => child, onError },
  );
  child.emit("close", null, "SIGKILL");
  expect(onError).toHaveBeenCalledWith(new Error("Broadcastify FFmpeg exited (SIGKILL)"));
  await supervisor.close();
});

test("waits for FFmpeg shutdown and force kills it after the grace period", async () => {
  const child = childProcess();
  child.kill = jest.fn();
  const timers = [];
  const supervisor = createBroadcastifySupervisor(
    { enabled: true },
    {
      spawnProcess: () => child,
      setTimeoutImpl: (callback, ms) => (timers.push({ callback, ms }), timers.length),
      clearTimeoutImpl: jest.fn(),
    },
  );
  const closing = supervisor.close();
  expect(supervisor.close()).toBe(closing);
  expect(child.stdin.end).toHaveBeenCalled();
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  timers.find(({ ms }) => ms === 5000).callback();
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  child.emit("close", null, "SIGKILL");
  await closing;
});

test("recovers from synchronous spawn failure and accepts a disabled configuration", async () => {
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
  await supervisor.close();
  timers[1]();
  const disabled = createBroadcastifySupervisor({ enabled: false });
  expect(disabled.ready()).toBe(true);
  expect(disabled.status()).toEqual({ state: "disabled" });
  await disabled.close();
});

test("does not schedule another retry if startup failure closes the supervisor", async () => {
  let supervisor;
  let closing;
  let attempts = 0;
  const timers = [];
  supervisor = createBroadcastifySupervisor(
    { enabled: true },
    {
      spawnProcess: () => {
        attempts += 1;
        if (attempts > 1) closing = supervisor.close();
        throw new Error("spawn failed");
      },
      setTimeoutImpl: (callback) => (timers.push(callback), timers.length),
      clearTimeoutImpl: jest.fn(),
    },
  );
  timers[0]();
  await closing;
  expect(attempts).toBe(2);
  expect(timers).toHaveLength(1);
});
