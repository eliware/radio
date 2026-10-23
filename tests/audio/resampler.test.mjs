import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createAudioResampler } from "../../src/audio/resampler.mjs";

function createStreamHarness(streams) {
  return () => {
    const stream = new EventEmitter();
    stream.write = jest.fn();
    stream.destroy = jest.fn();
    streams.push(stream);
    return stream;
  };
}

test("converts float samples to clipped s16le and forwards resampled PCM", () => {
  const streams = [];
  const pcmChunks = [];
  const resampler = createAudioResampler({
    onPcm: (pcm) => pcmChunks.push(pcm),
    createStreamImpl: createStreamHarness(streams),
  });
  const input = Buffer.alloc(16);
  [-2, 2, Number.NaN, 0.5].forEach((sample, index) => input.writeFloatLE(sample, index * 4));

  resampler.write(input);
  const bytes = streams[0].write.mock.calls[0][0];
  expect(bytes.readInt16LE(0)).toBe(-32767);
  expect(bytes.readInt16LE(2)).toBe(32767);
  expect(bytes.readInt16LE(4)).toBe(0);
  expect(bytes.readInt16LE(6)).toBe(16384);
  streams[0].emit("data", Buffer.from([1, 2]));
  expect(pcmChunks).toEqual([Buffer.from([1, 2])]);
  resampler.close();
});

test("reports stream errors and rejects malformed or closed writes", () => {
  const streams = [];
  const onError = jest.fn();
  const resampler = createAudioResampler({
    onPcm: () => {},
    onError,
    createStreamImpl: createStreamHarness(streams),
  });
  streams[0].emit("error", new Error("stream failed"));
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "stream failed" }));
  expect(() => resampler.write(Buffer.alloc(3))).toThrow("float32");
  resampler.close();
  expect(() => resampler.write(Buffer.alloc(4))).toThrow("closed");
});

test("reset replaces the stream and shutdown methods are repeatable", () => {
  const streams = [];
  const resampler = createAudioResampler({
    onPcm: () => {},
    createStreamImpl: createStreamHarness(streams),
  });
  streams[0].emit("error", new Error("ignored stream error"));
  resampler.reset();
  expect(streams[0].destroy).toHaveBeenCalledTimes(1);
  expect(streams).toHaveLength(2);
  resampler.close();
  resampler.reset();
  resampler.close();
  expect(streams[1].destroy).toHaveBeenCalledTimes(1);
});
