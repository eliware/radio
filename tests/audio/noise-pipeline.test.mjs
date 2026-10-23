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

test("resamples Airband frames, denoises 480-sample frames, and emits 48 kHz Opus packets", () => {
  const packets = [];
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
    onPacket: (packet) => packets.push(packet),
  });
  pipeline.write(makeAudio());
  expect(frames.length).toBeGreaterThan(1);
  expect(frames.every((size) => size === 480)).toBe(true);
  expect(packets.length).toBeGreaterThan(0);
  expect(packets.every((packet) => packet.length > 0)).toBe(true);
  pipeline.finishTransmission();
  pipeline.close();
  expect(destroy).toHaveBeenCalledTimes(1);
});

test("reports RNNoise and packet callback failures", () => {
  const onError = jest.fn();
  const noise = makeRnnoise(() => {
    throw new Error("denoiser failed");
  });
  const pipeline = createNoisePipeline({ rnnoise: noise, onPacket: () => {}, onError });
  pipeline.write(makeAudio());
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "denoiser failed" }));
  pipeline.close();

  const packetError = jest.fn();
  const throwingPipeline = createNoisePipeline({
    rnnoise: makeRnnoise(),
    onPacket: () => {
      throw new Error("send failed");
    },
    onError: packetError,
  });
  throwingPipeline.write(makeAudio());
  expect(packetError).toHaveBeenCalledWith(expect.objectContaining({ message: "send failed" }));
  throwingPipeline.close();
});

test("uses the default error handler and replaces non-finite samples with silence", () => {
  const pipeline = createNoisePipeline({
    rnnoise: makeRnnoise(() => {
      throw new Error("handled by default");
    }),
    onPacket: () => {},
  });
  const audio = makeAudio();
  audio.writeFloatLE(Number.NaN, 0);
  pipeline.write(audio);
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
