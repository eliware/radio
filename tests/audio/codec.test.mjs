import {
  createEncoder,
  encodeFloatFrame,
  codecHeader,
  FRAME_BYTES,
} from "../../src/audio/codec.mjs";

test("describes 16 kHz mono Opus frames of 20 ms", () => {
  expect(Buffer.from(codecHeader(), "base64")).toEqual(Buffer.from([0x80, 0x3e, 1, 20]));
});

test("encodes a 20 ms float frame and rejects wrong frame sizes", () => {
  const encoder = createEncoder();
  const frame = Buffer.alloc(FRAME_BYTES);
  expect(encodeFloatFrame(encoder, frame).length).toBeGreaterThan(0);
  frame.writeFloatLE(Number.NaN, 0);
  expect(encodeFloatFrame(encoder, frame).length).toBeGreaterThan(0);
  expect(() => encodeFloatFrame(encoder, Buffer.alloc(4))).toThrow("20 ms");
  encoder.delete();
});
