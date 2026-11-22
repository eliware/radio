import { expect, test } from "@jest/globals";
import convertFloatPcmToS16le from "../../src/audio/pcm-conversion.mjs";

test("converts and clips float samples into signed 16-bit little-endian PCM", () => {
  const input = Buffer.alloc(16);
  [-2, 2, Number.NaN, 0.5].forEach((sample, index) => input.writeFloatLE(sample, index * 4));
  const output = convertFloatPcmToS16le(input);
  expect(output.readInt16LE(0)).toBe(-32767);
  expect(output.readInt16LE(2)).toBe(32767);
  expect(output.readInt16LE(4)).toBe(0);
  expect(output.readInt16LE(6)).toBe(16384);
});
