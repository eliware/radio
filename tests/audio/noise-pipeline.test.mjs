import { expect, jest, test } from "@jest/globals";
import { createNoisePipeline } from "../../src/audio/noise-pipeline.mjs";

function makeRnnoise(processFrame = () => 0) {
  return {
    frameSize: 480,
    createDenoiseState: () => ({ processFrame, destroy: jest.fn() }),
  };
}

function makeAudio(blocks = 4) {
  return Buffer.concat(
    Array.from({ length: blocks }, (_, block) => {
      const chunk = Buffer.alloc(320 * 4);
      for (let i = 0; i < 320; i += 1) {
        const n = block * 320 + i;
        chunk.writeFloatLE(0.25 * Math.sin((2 * Math.PI * 1000 * n) / 16000), i * 4);
      }
      return chunk;
    }),
  );
}

test("resamples Airband audio and denoises 480-sample frames", () => {
  const frames = [];
  const destroy = jest.fn();
  const state = {
    frameSize: 480,
    createDenoiseState: () => ({
      processFrame: (frame) => frames.push(frame.length),
      destroy,
    }),
  };
  const pipeline = createNoisePipeline({
    rnnoise: state,
    onPacket: () => {},
  });
  pipeline.write(makeAudio());
  expect(frames.length).toBeGreaterThan(1);
  expect(frames.every((size) => size === 480)).toBe(true);
  pipeline.finishTransmission();
  pipeline.close();
  expect(destroy).toHaveBeenCalledTimes(1);
});

test("reports RNNoise failures", () => {
  const onError = jest.fn();
  const noise = makeRnnoise(() => {
    throw new Error("denoiser failed");
  });
  const pipeline = createNoisePipeline({ rnnoise: noise, onPacket: () => {}, onError });
  pipeline.write(makeAudio());
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "denoiser failed" }));
  pipeline.close();
});

test("uses the default error handler", () => {
  const pipeline = createNoisePipeline({
    rnnoise: makeRnnoise(() => {
      throw new Error("handled by default");
    }),
    onPacket: () => {},
  });
  pipeline.write(makeAudio());
  pipeline.close();
});

test("rejects malformed samples and writes after close while close and finish are repeatable", () => {
  const pipeline = createNoisePipeline({ rnnoise: makeRnnoise(), onPacket: () => {} });
  expect(() => pipeline.write(Buffer.alloc(3))).toThrow("float32");
  pipeline.finishTransmission();
  pipeline.close();
  pipeline.close();
  pipeline.finishTransmission();
  expect(() => pipeline.write(Buffer.alloc(4))).toThrow("closed");
});
