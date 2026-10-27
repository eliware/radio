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
      frame[0] = 2000 / 32768;
      frame[1] = -2000 / 32768;
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

test("converts signed PCM samples to normalized RNNoise floats and scales output back", () => {
  const observed = [];
  const output = [];
  const denoiser = createAudioDenoiser({
    rnnoise: makeRnnoise((frame) => {
      observed.push(...frame);
      frame[0] = 0.25;
      frame[1] = -0.25;
    }),
    onPcm: (pcm) => output.push(pcm),
  });
  const input = Buffer.alloc(4);
  input.writeInt16LE(16384, 0);
  input.writeInt16LE(-32768, 2);
  denoiser.write(input);
  expect(observed).toEqual([0.5, -1]);
  expect(output[0].readInt16LE(0)).toBe(8192);
  expect(output[0].readInt16LE(2)).toBe(-8192);
  denoiser.close();
});

test("drops buffered audio and rebuilds RNNoise after processing errors", () => {
  const errors = [];
  const state = {
    processFrame: () => {
      throw new Error("denoise failed");
    },
    destroy: jest.fn(() => {
      throw new Error("destroy failed");
    }),
  };
  const recovered = { processFrame: () => {}, destroy: jest.fn() };
  let stateCount = 0;
  const rnnoise = {
    frameSize: 2,
    createDenoiseState: () => (stateCount++ === 0 ? state : recovered),
  };
  const denoiser = createAudioDenoiser({
    rnnoise,
    onPcm: () => {},
    onError: (error) => errors.push(error.message),
  });
  denoiser.write(Buffer.alloc(2));
  denoiser.reset();
  denoiser.write(Buffer.alloc(8));
  expect(errors).toEqual(["destroy failed", "denoise failed"]);
  expect(stateCount).toBe(2);
  denoiser.write(Buffer.alloc(4));
  denoiser.close();
  denoiser.close();
  denoiser.reset();
  expect(recovered.destroy).toHaveBeenCalledTimes(1);
  expect(() => denoiser.write(Buffer.alloc(4))).toThrow("closed");
});

test("drops remaining audio after output callback errors", () => {
  const output = [];
  let shouldFail = true;
  const denoiser = createAudioDenoiser({
    rnnoise: makeRnnoise(),
    onPcm: (pcm) => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error("output failed");
      }
      output.push(pcm);
    },
  });
  denoiser.write(Buffer.alloc(8));
  denoiser.write(Buffer.alloc(4));
  expect(output).toHaveLength(1);
  denoiser.close();
});

test("reports RNNoise state recreation failures", () => {
  const errors = [];
  let count = 0;
  const rnnoise = {
    frameSize: 2,
    createDenoiseState: () => {
      count += 1;
      if (count > 1) throw new Error("reset failed");
      return {
        processFrame: () => {
          throw new Error("frame failed");
        },
        destroy: jest.fn(),
      };
    },
  };
  const denoiser = createAudioDenoiser({
    rnnoise,
    onPcm: () => {},
    onError: (error) => errors.push(error.message),
  });
  denoiser.write(Buffer.alloc(4));
  expect(errors).toEqual(["reset failed", "frame failed"]);
  denoiser.close();
});

test("reports state destruction failures while completing close", () => {
  const errors = [];
  const denoiser = createAudioDenoiser({
    rnnoise: {
      frameSize: 2,
      createDenoiseState: () => ({
        processFrame: () => {},
        destroy: () => {
          throw new Error("destroy failed");
        },
      }),
    },
    onPcm: () => {},
    onError: (error) => errors.push(error.message),
  });
  expect(() => denoiser.close()).toThrow("destroy failed");
  expect(errors).toEqual(["destroy failed"]);
  expect(() => denoiser.write(Buffer.alloc(4))).toThrow("closed");
});

test("drops buffered frames and rebuilds RNNoise state after a processing error", () => {
  const errors = [];
  const output = [];
  const states = [];
  const rnnoise = {
    frameSize: 2,
    createDenoiseState: () => {
      const state = {
        processFrame:
          states.length === 0
            ? () => {
                throw new Error("frame failed");
              }
            : () => {},
        destroy: jest.fn(),
      };
      states.push(state);
      return state;
    },
  };
  const denoiser = createAudioDenoiser({
    rnnoise,
    onPcm: (pcm) => output.push(pcm),
    onError: (error) => errors.push(error.message),
  });
  denoiser.write(Buffer.alloc(8));
  expect(output).toHaveLength(0);
  expect(errors).toEqual(["frame failed"]);
  expect(states[0].destroy).toHaveBeenCalledTimes(1);
  denoiser.write(Buffer.alloc(4));
  expect(output).toHaveLength(1);
  expect(states).toHaveLength(2);
  denoiser.close();
});
