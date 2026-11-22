import { expect, jest, test } from "@jest/globals";
import createDenoiserState from "../../../src/audio/denoiser/state.mjs";

test("processes frames through the current RNNoise state", () => {
  const frame = new Float32Array([1, 2]);
  const processFrame = jest.fn();
  const state = createDenoiserState({
    rnnoise: { createDenoiseState: () => ({ processFrame, destroy: jest.fn() }) },
    onError: jest.fn(),
  });
  state.processFrame(frame);
  expect(processFrame).toHaveBeenCalledWith(frame);
});

test("recreates the RNNoise state after a processing failure", () => {
  const error = new Error("process failed");
  const destroy = jest.fn();
  const recoveredState = { processFrame: jest.fn(), destroy: jest.fn() };
  const createDenoiseState = jest
    .fn()
    .mockReturnValueOnce({ processFrame: jest.fn(), destroy })
    .mockReturnValueOnce(recoveredState);
  const onError = jest.fn();
  const state = createDenoiserState({ rnnoise: { createDenoiseState }, onError });
  state.recover(error);
  state.processFrame(new Float32Array(1));
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(error);
  expect(recoveredState.processFrame).toHaveBeenCalled();
});

test("reports destruction errors and rethrows them on close", () => {
  const error = new Error("destroy failed");
  const onError = jest.fn();
  const state = createDenoiserState({
    rnnoise: {
      createDenoiseState: () => ({
        processFrame: jest.fn(),
        destroy: () => {
          throw error;
        },
      }),
    },
    onError,
  });
  expect(() => state.close()).toThrow(error);
  expect(onError).toHaveBeenCalledWith(error);
});
