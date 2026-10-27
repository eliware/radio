import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { registerRadioShutdown } from "../src/radio-shutdown.mjs";

function setup({ runtime, server, rejectShutdown } = {}) {
  const processImpl = new EventEmitter();
  const removeHandlers = jest.fn();
  const log = { info: jest.fn(), error: jest.fn() };
  let shutdownHook;
  const shutdown = jest.fn(() =>
    rejectShutdown ? Promise.reject(new Error("shutdown failed")) : Promise.resolve(),
  );
  const signals = registerRadioShutdown({
    processImpl,
    registerHandlersImpl: jest.fn(() => ({ removeHandlers })),
    registerSignalsImpl: jest.fn(({ shutdownHook: hook }) => {
      shutdownHook = hook;
      return { shutdown };
    }),
    getRuntime: () => runtime,
    getServer: () => server,
    log,
  });
  return { processImpl, removeHandlers, log, shutdownHook, shutdown, signals };
}

test("closes the runtime and listening server during shutdown", async () => {
  const runtime = { close: jest.fn() };
  const server = { listening: true, close: jest.fn((callback) => callback()) };
  const state = setup({ runtime, server });
  await state.shutdownHook("SIGTERM");
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(server.close).toHaveBeenCalledTimes(1);
  expect(state.removeHandlers).toHaveBeenCalledTimes(1);
  expect(state.log.info).toHaveBeenCalledWith("Radio shutdown started", { signal: "SIGTERM" });
  expect(state.processImpl.listenerCount("uncaughtException")).toBe(0);
  expect(state.processImpl.listenerCount("unhandledRejection")).toBe(0);
});

test("skips absent runtime and stopped server during shutdown", async () => {
  const server = { listening: false, close: jest.fn() };
  const state = setup({ server });
  await state.shutdownHook("SIGINT");
  expect(server.close).not.toHaveBeenCalled();
  expect(state.removeHandlers).toHaveBeenCalledTimes(1);
});

test("routes fatal process errors to shutdown and reports shutdown failures", async () => {
  const state = setup({ rejectShutdown: true });
  state.processImpl.emit("uncaughtException", new Error("fatal"));
  expect(state.processImpl.exitCode).toBe(1);
  expect(state.shutdown).toHaveBeenCalledWith("fatal process error");
  await Promise.resolve();
  expect(state.log.error).toHaveBeenCalledWith(
    "Fatal shutdown failure",
    expect.objectContaining({ error: expect.objectContaining({ message: "shutdown failed" }) }),
  );

  state.processImpl.emit("unhandledRejection", new Error("rejected"));
  expect(state.shutdown).toHaveBeenCalledTimes(2);
  await Promise.resolve();
});
