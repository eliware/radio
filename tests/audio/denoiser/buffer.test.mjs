import { expect, jest, test } from "@jest/globals";
import createPcmFrameBuffer from "../../../src/audio/denoiser/buffer.mjs";

test("combines chunks into complete PCM frames", () => {
  const buffer = createPcmFrameBuffer(4);
  const frames = [];
  const onFrame = jest.fn((frame) => frames.push([...frame]));
  buffer.write(Buffer.from([1, 2]), onFrame);
  expect(onFrame).not.toHaveBeenCalled();

  buffer.write(Buffer.from([3, 4, 5, 6, 7, 8]), onFrame);
  expect(frames).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
  ]);
});

test("reset drops an incomplete frame", () => {
  const buffer = createPcmFrameBuffer(4);
  const onFrame = jest.fn();
  buffer.write(Buffer.from([1, 2]), onFrame);
  buffer.reset();
  buffer.write(Buffer.from([3, 4]), onFrame);
  expect(onFrame).not.toHaveBeenCalled();
  buffer.write(Buffer.from([5, 6]), onFrame);
  expect([...onFrame.mock.calls[0][0]]).toEqual([3, 4, 5, 6]);
});
