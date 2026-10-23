import { expect, jest, test } from "@jest/globals";
import { createZelloAudioSender } from "../../src/zello/audio-sender.mjs";

test("sends a binary packet with stream and sequence headers", () => {
  const socket = { readyState: 1, send: jest.fn() };
  const sendAudio = createZelloAudioSender({
    getSocket: () => socket,
    isOnline: () => true,
    openState: 1,
  });
  sendAudio(23, Buffer.from([1, 2, 3]));
  const [data, options] = socket.send.mock.calls[0];
  expect(options).toEqual({ binary: true });
  expect(data).toHaveLength(12);
  expect(data.readUInt8(0)).toBe(1);
  expect(data.readUInt32BE(1)).toBe(23);
  expect(data.readUInt32BE(5)).toBe(0);
  expect(data.subarray(9)).toEqual(Buffer.from([1, 2, 3]));
});

test("rejects audio when disconnected or the socket is not open", () => {
  const socket = { readyState: 0, send: jest.fn() };
  const sendAudio = createZelloAudioSender({
    getSocket: () => socket,
    isOnline: () => true,
    openState: 1,
  });
  expect(() => sendAudio(23, Buffer.alloc(1))).toThrow("offline");
  const offlineSender = createZelloAudioSender({
    getSocket: () => socket,
    isOnline: () => false,
    openState: 1,
  });
  expect(() => offlineSender(23, Buffer.alloc(1))).toThrow("offline");
  expect(socket.send).not.toHaveBeenCalled();
});
