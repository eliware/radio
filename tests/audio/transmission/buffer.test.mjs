import { expect, jest, test } from "@jest/globals";
import { FRAME_SAMPLES } from "../../../src/audio/codec.mjs";
import { createTransmissionBuffer } from "../../../src/audio/transmission/buffer.mjs";

test("accumulates PCM and flushes complete frames", () => {
  const buffer = createTransmissionBuffer();
  const onFrame = jest.fn();
  const frameBytes = (FRAME_SAMPLES / 3) * 4;
  buffer.append(Buffer.alloc(800, 1));
  buffer.flush(onFrame);
  expect(onFrame).not.toHaveBeenCalled();

  buffer.append(Buffer.alloc(frameBytes - 800, 2));
  buffer.flush(onFrame);
  expect(onFrame).toHaveBeenCalledTimes(1);
  expect(onFrame.mock.calls[0][0]).toEqual(
    Buffer.concat([Buffer.alloc(800, 1), Buffer.alloc(frameBytes - 800, 2)]),
  );
  expect(buffer.length).toBe(0);
});

test("discards incomplete frames or all buffered PCM", () => {
  const buffer = createTransmissionBuffer();
  const frameBytes = (FRAME_SAMPLES / 3) * 4;
  buffer.append(Buffer.alloc(frameBytes + 120));
  buffer.keepCompleteFrames();
  expect(buffer.length).toBe(frameBytes);
  buffer.clear();
  expect(buffer.length).toBe(0);
});
