import { expect, test } from "@jest/globals";
import { FRAME_BYTES, FRAME_SAMPLES } from "../../src/audio/codec.mjs";
import { createEncoder, encodeFloatFrame, encodePcmFrame } from "../../src/audio/encoder.mjs";

test("encodes 20 ms float and PCM frames and rejects incorrect sizes", () => {
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
