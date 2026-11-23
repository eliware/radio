import { expect, jest, test } from "@jest/globals";
import createDenoiserFrameProcessor from "../../../src/audio/denoiser/frame-processor.mjs";

test("normalizes signed PCM for RNNoise and mixes denoised samples", () => {
  const seen = [];
  const outputs = [];
  const processFrame = createDenoiserFrameProcessor({
    frameSize: 2,
    processFrame: (frame) => {
      seen.push(...frame);
      frame[0] = 0.75;
      frame[1] = -0.75;
    },
    rnnoiseMix: 0.5,
    onPcm: (pcm) => outputs.push(pcm),
  });
  const input = Buffer.alloc(4);
  input.writeInt16LE(10000, 0);
  input.writeInt16LE(-10000, 2);

  processFrame(input);

  expect(seen).toEqual([10000 / 32768, -10000 / 32768]);
  expect(outputs[0].readInt16LE(0)).toBe(17288);
  expect(outputs[0].readInt16LE(2)).toBe(-17288);
});

test("clamps mixed samples to signed 16 bit limits", () => {
  const output = jest.fn();
  createDenoiserFrameProcessor({
    frameSize: 2,
    processFrame: (frame) => {
      frame[0] = 2;
      frame[1] = -2;
    },
    rnnoiseMix: 1,
    onPcm: output,
  })(Buffer.alloc(4));

  expect(output.mock.calls[0][0].readInt16LE(0)).toBe(32767);
  expect(output.mock.calls[0][0].readInt16LE(2)).toBe(-32768);
});
