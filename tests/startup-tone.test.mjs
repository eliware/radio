import { expect, jest, test } from "@jest/globals";
import { sendStartupTone } from "../src/startup-tone.mjs";

test("uses the standard timer when no wait helper is supplied", async () => {
  jest.useFakeTimers();
  const sent = [];
  const session = {
    startStream: async () => 3,
    sendAudio: (_id, packet) => sent.push(packet),
    stopStream: async () => {},
  };
  const sending = sendStartupTone(session, 1000);
  await jest.advanceTimersByTimeAsync(1000);
  await sending;
  jest.useRealTimers();
  expect(sent).toHaveLength(50);
});

test("sends and stops a one-second, 20 ms packetized startup tone", async () => {
  const sent = [];
  const calls = [];
  const session = {
    startStream: async () => 17,
    sendAudio: (_id, data) => sent.push(data),
    stopStream: async (id) => calls.push(id),
  };
  await sendStartupTone(session, 1300, async (ms) => calls.push(ms));
  expect(sent).toHaveLength(50);
  expect(sent.every(Buffer.isBuffer)).toBe(true);
  expect(calls.filter((value) => value === 20)).toHaveLength(50);
  expect(calls.at(-1)).toBe(17);
});
