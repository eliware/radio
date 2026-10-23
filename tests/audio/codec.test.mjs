import {
  createEncoder,
  encodePcmFrame,
  encodeFloatFrame,
  codecHeader,
  FRAME_BYTES,
  FRAME_SAMPLES,
} from "../../src/audio/codec.mjs";

test("describes 48 kHz mono Opus frames of 20 ms", () => {
  expect(Buffer.from(codecHeader(), "base64")).toEqual(Buffer.from([0x80, 0xbb, 1, 20]));
});

test("encodes a 20 ms float frame and rejects wrong frame sizes", () => {
  const encoder = createEncoder();
  const frame = Buffer.alloc(FRAME_BYTES);
  expect(encodeFloatFrame(encoder, frame).length).toBeGreaterThan(0);
  expect(encodePcmFrame(encoder, Buffer.alloc(FRAME_SAMPLES * 2)).length).toBeGreaterThan(0);
  frame.writeFloatLE(Number.NaN, 0);
  expect(encodeFloatFrame(encoder, frame).length).toBeGreaterThan(0);
  expect(() => encodeFloatFrame(encoder, Buffer.alloc(4))).toThrow("20 ms");
  expect(() => encodePcmFrame(encoder, Buffer.alloc(2))).toThrow("s16le PCM");
  encoder.delete();
});
