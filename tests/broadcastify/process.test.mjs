import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { monitorBroadcastifyProcess } from "../../src/broadcastify/process.mjs";

function setup(overrides = {}) {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  const callbacks = {
    settings: { name: "Fire", password: "private", mount: "/feed" },
    isCurrent: () => true,
    isClosed: () => false,
    onError: jest.fn(),
    onSpawn: jest.fn(),
    onProcessError: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  monitorBroadcastifyProcess(child, callbacks);
  return { child, callbacks };
}

test("handles spawn and pipe errors, then sanitizes FFmpeg stderr on exit", () => {
  const state = setup();
  state.child.stderr.emit("data", "Connection to icecast://source:private@host/feed failed");
  state.child.emit("spawn");
  state.child.stdin.emit("error", new Error("raw pipe error"));
  state.child.emit("close", 1, null);
  expect(state.callbacks.onSpawn).toHaveBeenCalledTimes(1);
  expect(state.callbacks.onError).toHaveBeenNthCalledWith(
    1,
    new Error("Broadcastify audio pipe failed"),
  );
  expect(state.callbacks.onError).toHaveBeenLastCalledWith(
    new Error("Fire FFmpeg exited (code 1: Connection to icecast://[redacted] failed)"),
  );
  expect(state.callbacks.onClose).toHaveBeenCalledWith({ failed: false });
});

test("reports process errors once and ignores stale process events", () => {
  const state = setup();
  state.child.emit("error", new Error("spawn failure"));
  state.child.emit("close", 1, null);
  expect(state.callbacks.onError).toHaveBeenCalledWith(
    new Error("Broadcastify FFmpeg process failed"),
  );
  expect(state.callbacks.onProcessError).toHaveBeenCalledTimes(1);
  expect(state.callbacks.onClose).toHaveBeenCalledWith({ failed: true });

  const stale = setup({ isCurrent: () => false });
  stale.child.emit("spawn");
  stale.child.emit("error", new Error("late failure"));
  stale.child.emit("close", 1, null);
  expect(stale.callbacks.onSpawn).not.toHaveBeenCalled();
  expect(stale.callbacks.onError).not.toHaveBeenCalled();
  expect(stale.callbacks.onClose).not.toHaveBeenCalled();
});

test("ignores spawn and error events during shutdown and supports absent stderr", () => {
  const state = setup({ isClosed: () => true });
  state.child.emit("spawn");
  state.child.emit("error", new Error("shutdown"));
  state.child.emit("close", null, "SIGTERM");
  expect(state.callbacks.onSpawn).not.toHaveBeenCalled();
  expect(state.callbacks.onError).not.toHaveBeenCalled();
  expect(state.callbacks.onClose).toHaveBeenCalledWith({ failed: false });

  const child = new EventEmitter();
  child.stdin = new EventEmitter();
  const callbacks = { ...state.callbacks, isClosed: () => false, onClose: jest.fn() };
  monitorBroadcastifyProcess(child, callbacks);
  child.emit("close", null, "SIGKILL");
  expect(callbacks.onError).toHaveBeenLastCalledWith(new Error("Fire FFmpeg exited (SIGKILL)"));
});
