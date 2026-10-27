import { expect, jest, test } from "@jest/globals";
import { FRAME_BYTES } from "../../src/audio/codec.mjs";
import { createAudioPacketizer } from "../../src/audio/packetizer.mjs";

function createEncoderHarness() {
  const encode = jest.fn((frame) => Buffer.from(frame.subarray(0, 3)));
  const remove = jest.fn();
  return { createEncoderImpl: () => ({ encode, delete: remove }), encode, remove };
}

test("buffers PCM and emits one encoded packet per complete Opus frame", () => {
  const packets = [];
  const harness = createEncoderHarness();
  const packetizer = createAudioPacketizer({
    onPacket: (packet) => packets.push(packet),
    createEncoderImpl: harness.createEncoderImpl,
  });
  const pcm = Buffer.alloc(FRAME_BYTES / 2 + 4, 7);
  packetizer.write(pcm.subarray(0, 100));
  expect(packets).toHaveLength(0);
  packetizer.write(pcm.subarray(100));
  expect(harness.encode).toHaveBeenCalledTimes(1);
  expect(harness.encode.mock.calls[0][0]).toHaveLength(FRAME_BYTES / 2);
  expect(packets).toHaveLength(1);
  packetizer.close();
  expect(harness.remove).toHaveBeenCalledTimes(1);
});

test("emits one 20 ms packet for each resampled PCM frame", () => {
  const harness = createEncoderHarness();
  const packetizer = createAudioPacketizer({
    onPacket: () => {},
    createEncoderImpl: harness.createEncoderImpl,
  });
  const frameBytes = FRAME_BYTES / 2;
  packetizer.write(Buffer.alloc(frameBytes * 3 - 1));
  expect(harness.encode).toHaveBeenCalledTimes(2);
  packetizer.write(Buffer.alloc(1));
  expect(harness.encode).toHaveBeenCalledTimes(3);
  expect(harness.encode.mock.calls.map(([frame]) => frame.length)).toEqual([
    frameBytes,
    frameBytes,
    frameBytes,
  ]);
  packetizer.close();
});

test("reset drops a partial frame and close is repeatable", () => {
  const harness = createEncoderHarness();
  const packets = [];
  const packetizer = createAudioPacketizer({
    onPacket: (packet) => packets.push(packet),
    createEncoderImpl: harness.createEncoderImpl,
  });
  packetizer.write(Buffer.alloc(10));
  packetizer.reset();
  packetizer.write(Buffer.alloc(FRAME_BYTES / 2 - 10));
  expect(packets).toHaveLength(0);
  packetizer.close();
  packetizer.reset();
  packetizer.close();
  expect(harness.remove).toHaveBeenCalledTimes(1);
  expect(() => packetizer.write(Buffer.alloc(1))).toThrow("closed");
});

test("forwards packet callback failures", () => {
  const packetizer = createAudioPacketizer({
    onPacket: () => {
      throw new Error("send failed");
    },
  });
  expect(() => packetizer.write(Buffer.alloc(FRAME_BYTES / 2))).toThrow("send failed");
  packetizer.close();
});
