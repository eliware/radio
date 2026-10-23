import { expect, test } from "@jest/globals";
import { codecHeader } from "../../src/audio/codec.mjs";

test("describes 48 kHz mono Opus frames of 20 ms", () => {
  expect(Buffer.from(codecHeader(), "base64")).toEqual(Buffer.from([0x80, 0xbb, 1, 20]));
});
