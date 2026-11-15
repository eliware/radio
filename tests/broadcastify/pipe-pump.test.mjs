import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createBroadcastifyPipePump } from "../../src/broadcastify/pipe-pump.mjs";

function childProcess() {
  const stdin = Object.assign(new EventEmitter(), {
    writable: true,
    writableLength: 0,
    write: jest.fn(),
    destroy: jest.fn(),
  });
  return { stdin };
}

test("writes queued PCM and retains the packet when the pipe is not writable", () => {
  const child = childProcess();
  const nextPcm = jest.fn(() => Buffer.alloc(960));
  const onError = jest.fn();
  const pump = createBroadcastifyPipePump({ getChild: () => child, nextPcm, onError });
  expect(pump()).toBe(true);
  expect(child.stdin.write).toHaveBeenCalledWith(Buffer.alloc(960));
  child.stdin.writable = false;
  expect(pump()).toBe(true);
  expect(pump()).toBe(true);
  expect(nextPcm).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(new Error("Broadcastify audio pipe is not writable"));
  expect(onError).toHaveBeenCalledTimes(1);
});

test("reports pipe backpressure once and reports write failures", () => {
  const child = childProcess();
  const onError = jest.fn();
  const pump = createBroadcastifyPipePump({
    getChild: () => child,
    nextPcm: () => Buffer.alloc(960),
    onError,
  });
  child.stdin.writableLength = 96001;
  pump();
  pump();
  expect(onError).toHaveBeenCalledTimes(1);
  child.stdin.writableLength = 0;
  child.stdin.writable = true;
  child.stdin.write.mockImplementation(() => {
    throw new Error("pipe failure");
  });
  pump();
  expect(onError).toHaveBeenLastCalledWith(new Error("Broadcastify audio pipe write failed"));
  expect(child.stdin.destroy).toHaveBeenCalledWith(expect.any(Error));
});

test("returns false when the encoder child is unavailable", () => {
  const pump = createBroadcastifyPipePump({
    getChild: () => undefined,
    nextPcm: jest.fn(),
    onError: jest.fn(),
  });
  expect(pump()).toBe(false);
});
