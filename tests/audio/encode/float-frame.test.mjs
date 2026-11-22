import { expect, test } from "@jest/globals";
import encodeFloatFrame from "../../../src/audio/encode/float-frame.mjs";
import { FRAME_BYTES, FRAME_SAMPLES } from "../../../src/audio/codec.mjs";

test("converts float PCM and delegates to the PCM encoder", () => {
  const encoder = { encode: (pcm, samples) => ({ pcm, samples }) };
  const frame = Buffer.alloc(FRAME_BYTES);
  frame.writeFloatLE(2, 0);
  const encoded = encodeFloatFrame(encoder, frame);
  expect(encoded.samples).toBe(FRAME_SAMPLES);
  expect(encoded.pcm.readInt16LE(0)).toBe(32767);
});
