import { expect, jest, test } from "@jest/globals";
import createDenoiserFrameProcessor from "../../../src/audio/denoiser/frame-processor.mjs";

test("converts signed PCM, mixes denoised samples, and clamps output", () => {
  const seen = [];
  const outputs = [];
  const processFrame = createDenoiserFrameProcessor({
    frameSize: 2,
    processFrame: (frame) => {
      seen.push(...frame);
      frame[0] = 40000;
      frame[1] = -40000;
    },
    rnnoiseMix: 0.5,
    onPcm: (pcm) => outputs.push(pcm),
  });
  const input = Buffer.alloc(4);
  input.writeInt16LE(10000, 0);
  input.writeInt16LE(-10000, 2);

  processFrame(input);

  expect(seen).toEqual([10000, -10000]);
  expect(outputs[0].readInt16LE(0)).toBe(25000);
  expect(outputs[0].readInt16LE(2)).toBe(-25000);
});

test("clamps mixed samples to signed 16 bit limits", () => {
  const output = jest.fn();
  createDenoiserFrameProcessor({
    frameSize: 2,
    processFrame: (frame) => {
      frame[0] = 50000;
      frame[1] = -50000;
    },
    rnnoiseMix: 1,
    onPcm: output,
  })(Buffer.alloc(4));

  expect(output.mock.calls[0][0].readInt16LE(0)).toBe(32767);
  expect(output.mock.calls[0][0].readInt16LE(2)).toBe(-32768);
});
