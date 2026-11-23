import { expect, jest, test } from "@jest/globals";
import maintainSessionChannel from "../../src/session/channel.mjs";

test("maintains a channel, plays its startup tone, and waits before retrying", async () => {
  let stopped = false;
  const channel = {
    name: "PD",
    config: { TONE: "1000" },
    status: "connecting",
    tonePlayed: false,
    session: { connect: jest.fn(), waitForClose: async () => new Error("closed") },
    resolveTone: jest.fn(),
  };
  const log = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };
  const pause = jest.fn(async () => (stopped = true));
  const playTone = jest.fn();
  await maintainSessionChannel(channel, {
    isStopped: () => stopped,
    pause,
    log,
    onError: jest.fn(),
    playTone,
    wait: jest.fn(),
  });
  expect(channel.session.connect).toHaveBeenCalledTimes(1);
  expect(playTone).toHaveBeenCalledWith(channel.session, 1000, expect.any(Function));
  expect(channel.resolveTone).toHaveBeenCalledTimes(1);
  expect(channel.status).toBe("degraded");
  expect(log.warn).toHaveBeenCalledWith("Zello channel disconnected", {
    channel: "PD",
    error: "closed",
  });
  expect(pause).toHaveBeenCalledWith(1000);
});

test("reports connection errors and backs off", async () => {
  let stopped = false;
  const channel = {
    name: "FD",
    config: {},
    tonePlayed: true,
    session: {
      connect: async () => {
        throw new Error("offline");
      },
    },
  };
  const onError = jest.fn();
  const pause = jest.fn(async () => (stopped = true));
  await maintainSessionChannel(channel, {
    isStopped: () => stopped,
    pause,
    log: { debug: () => {}, info: () => {}, warn: () => {} },
    onError,
    playTone: jest.fn(),
    wait: jest.fn(),
  });
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Zello channel FD: offline" }),
  );
  expect(pause).toHaveBeenCalledWith(1000);
});
