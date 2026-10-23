import { expect, jest, test } from "@jest/globals";
import { createSessionSupervisor } from "../src/session-supervisor.mjs";

const quietLog = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function channel(name) {
  let resolveClose;
  const session = {
    connected: 0,
    closed: false,
    online: false,
    connect: async function connect() {
      this.connected += 1;
      this.online = true;
    },
    close: function close() {
      this.closed = true;
      this.online = false;
      resolveClose?.();
    },
    healthy: function healthy() {
      return this.online;
    },
    waitForClose: () =>
      new Promise((resolve) => {
        resolveClose = resolve;
      }),
  };
  return { name, config: { TONE: "1000" }, session, tonePlayed: false };
}

test("keeps each Zello websocket connected between transmissions", async () => {
  const channels = [channel("PD"), channel("FD")];
  const tones = [];
  const supervisor = createSessionSupervisor(channels, {
    wait: async () => {},
    onError: () => {},
    log: quietLog,
    playTone: async (_session, frequency) => tones.push(frequency),
  });
  await supervisor.initialReady;
  expect(supervisor.ready()).toBe(true);
  expect(supervisor.status().PD.state).toBe("online");
  expect(tones).toEqual([1000, 1000]);
  expect(channels.map(({ session }) => session.connected)).toEqual([1, 1]);
  await supervisor.close();
  expect(channels.every(({ session }) => session.closed)).toBe(true);
  expect(supervisor.ready()).toBe(false);
  expect(supervisor.status().PD.state).toBe("disconnected");
});

test("retains its initial tone state across a reconnect and resets long-lived backoff", async () => {
  jest.useFakeTimers();
  const item = channel("PD");
  let closeWaits = 0;
  const delays = [];
  const sent = [];
  item.session.startStream = async () => 12;
  item.session.sendAudio = (_id, packet) => sent.push(packet);
  item.session.stopStream = async () => {};
  item.session.waitForClose = () => {
    closeWaits += 1;
    if (closeWaits === 1) return Promise.resolve();
    return new Promise((resolve) => (item.session.release = resolve));
  };
  const supervisor = createSessionSupervisor([item], {
    wait: async (ms) => delays.push(ms),
    onError: () => {},
    log: quietLog,
  });
  await supervisor.initialReady;
  await jest.advanceTimersByTimeAsync(30000);
  for (let attempt = 0; attempt < 20 && item.session.connected < 2; attempt += 1)
    await Promise.resolve();
  expect(item.session.connected).toBe(2);
  expect(item.tonePlayed).toBe(true);
  expect(sent).toHaveLength(50);
  item.session.release();
  await supervisor.close();
  jest.useRealTimers();
});

test("reconnects with exponential backoff after connection failures", async () => {
  const delays = [];
  const item = channel("PD");
  item.session.connect = async function reconnect() {
    this.connected += 1;
    if (this.connected <= 2) throw new Error("offline");
    this.online = true;
  };
  const supervisor = createSessionSupervisor([item], {
    wait: async (ms) => delays.push(ms),
    onError: () => {},
    log: quietLog,
    playTone: async () => {},
  });
  await supervisor.initialReady;
  expect(delays.slice(0, 2)).toEqual([1000, 2000]);
  expect(item.session.connected).toBe(3);
  await supervisor.close();
});

test("supports an empty supervisor with the shared logger defaults", async () => {
  const supervisor = createSessionSupervisor([], { wait: async () => {}, onError: () => {} });
  await supervisor.initialReady;
  expect(supervisor.ready()).toBe(true);
  await supervisor.close();
});
