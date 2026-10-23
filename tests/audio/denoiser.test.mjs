import { expect, jest, test } from "@jest/globals";
import { createAudioDenoiser } from "../../src/audio/denoiser.mjs";

function makeRnnoise(processFrame = () => {}) {
  return {
    frameSize: 2,
    createDenoiseState: () => ({ processFrame, destroy: jest.fn() }),
  };
}

test("buffers complete frames and mixes denoised PCM with original samples", () => {
  const output = [];
  const denoiser = createAudioDenoiser({
    rnnoise: makeRnnoise((frame) => {
      frame[0] = 2000;
      frame[1] = -2000;
    }),
    rnnoiseMix: 0.5,
    onPcm: (pcm) => output.push(pcm),
  });
  const input = Buffer.alloc(8);
  input.writeInt16LE(1000, 0);
  input.writeInt16LE(-1000, 2);
  denoiser.write(input.subarray(0, 2));
  expect(output).toHaveLength(0);
  denoiser.write(input.subarray(2));
  expect(output[0].readInt16LE(0)).toBe(1500);
  expect(output[0].readInt16LE(2)).toBe(-1500);
  denoiser.close();
});

test("reports processing errors, resets partial frames, and closes repeatedly", () => {
  const onError = jest.fn();
  const state = {
    processFrame: () => {
      throw new Error("denoise failed");
    },
    destroy: jest.fn(),
  };
  const rnnoise = { frameSize: 2, createDenoiseState: () => state };
  const denoiser = createAudioDenoiser({ rnnoise, onPcm: () => {}, onError });
  denoiser.write(Buffer.alloc(2));
  denoiser.reset();
  denoiser.write(Buffer.alloc(4));
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "denoise failed" }));
  denoiser.close();
  denoiser.close();
  denoiser.reset();
  expect(state.destroy).toHaveBeenCalledTimes(1);
  expect(() => denoiser.write(Buffer.alloc(4))).toThrow("closed");
});

test("uses the default error handler for output callback errors", () => {
  const denoiser = createAudioDenoiser({
    rnnoise: makeRnnoise(),
    onPcm: () => {
      throw new Error("output failed");
    },
  });
  denoiser.write(Buffer.alloc(4));
  denoiser.close();
});
