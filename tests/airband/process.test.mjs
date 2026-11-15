import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { startAirbandProcess } from "../../src/airband/process.mjs";

function setup({ kill = jest.fn(), timers = [] } = {}) {
  const child = new EventEmitter();
  child.kill = kill;
  const spawnProcess = jest.fn(() => child);
  const log = { info: jest.fn() };
  const onStarted = jest.fn();
  const onError = jest.fn();
  const processRun = startAirbandProcess({
    configPath: "/tmp/airband.conf",
    serials: ["851"],
    log,
    spawnProcess,
    onStarted,
    onError,
    shutdownTimeoutMs: 10,
    setTimeoutImpl: (callback, delay) => (timers.push({ callback, delay }), timers.length),
    clearTimeoutImpl: jest.fn(),
  });
  return { child, log, onStarted, onError, processRun, spawnProcess };
}

test("spawns Airband with its config and resolves clean process exits", async () => {
  const state = setup();
  expect(state.spawnProcess).toHaveBeenCalledWith(
    "rtl_airband",
    ["-F", "-e", "-c", "/tmp/airband.conf"],
    {
      stdio: "inherit",
    },
  );
  expect(state.log.info).toHaveBeenCalledWith("Starting RTLSDR-Airband", { serials: ["851"] });
  state.child.emit("spawn");
  expect(state.onStarted).toHaveBeenCalledTimes(1);
  state.child.emit("close", 0, null);
  await expect(state.processRun.finished).resolves.toEqual({ code: 0, signal: null });
  expect(state.child.listenerCount("close")).toBe(0);
});

test("stops after process errors and force kills when the child will not close", async () => {
  const timers = [];
  const kill = jest.fn();
  const state = setup({ kill, timers });
  const error = new Error("process error");
  state.child.emit("error", error);
  expect(state.onError).toHaveBeenCalledWith(error);
  expect(kill).toHaveBeenCalledWith("SIGTERM");
  expect(timers[0].delay).toBe(10);
  timers[0].callback();
  await expect(state.processRun.finished).resolves.toMatchObject({
    signal: "SIGKILL",
    cause: { message: "process error" },
  });
  expect(kill).toHaveBeenLastCalledWith("SIGKILL");
});

test("tolerates a child without kill and repeated stop requests", async () => {
  const timers = [];
  const state = setup({ kill: null, timers });
  state.processRun.stop();
  state.processRun.stop();
  expect(timers).toHaveLength(1);
  timers[0].callback();
  await expect(state.processRun.finished).resolves.toMatchObject({ signal: "SIGKILL" });
});
