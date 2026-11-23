import { expect, jest, test } from "@jest/globals";
import recoverDenoiserState from "../../../src/audio/denoiser/recovery.mjs";

test("destroys old state, creates replacement state, and reports processing errors", () => {
  const oldState = { destroy: jest.fn() };
  const nextState = {};
  const rnnoise = { createDenoiseState: jest.fn(() => nextState) };
  const setState = jest.fn();
  const onError = jest.fn();
  const error = new Error("frame failed");
  recoverDenoiserState(oldState, setState, rnnoise, onError, error);
  expect(oldState.destroy).toHaveBeenCalledTimes(1);
  expect(setState).toHaveBeenCalledWith(nextState);
  expect(onError).toHaveBeenCalledWith(error);
});

test("reports destroy and recreation errors before the processing error", () => {
  const destroyError = new Error("destroy failed");
  const createError = new Error("create failed");
  const processingError = new Error("frame failed");
  const oldState = {
    destroy: () => {
      throw destroyError;
    },
  };
  const onError = jest.fn();
  recoverDenoiserState(
    oldState,
    jest.fn(),
    {
      createDenoiseState: () => {
        throw createError;
      },
    },
    onError,
    processingError,
  );
  expect(onError.mock.calls).toEqual([[destroyError], [processingError]]);
});
