import { expect, jest, test } from "@jest/globals";
import encodePcmFrame from "../../../src/audio/encode/pcm-frame.mjs";
import { FRAME_SAMPLES } from "../../../src/audio/codec.mjs";

test("encodes one 20 ms s16le frame", () => {
  const encoder = { encode: jest.fn(() => Buffer.from([1])) };
  const pcm = Buffer.alloc(FRAME_SAMPLES * 2);
  expect(encodePcmFrame(encoder, pcm)).toEqual(Buffer.from([1]));
  expect(encoder.encode).toHaveBeenCalledWith(pcm, FRAME_SAMPLES);
});
