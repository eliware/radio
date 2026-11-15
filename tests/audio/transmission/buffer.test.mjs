import { expect, jest, test } from "@jest/globals";
import { createTransmissionBuffer } from "../../../src/audio/transmission/buffer.mjs";

test("accumulates PCM and flushes complete frames", () => {
  const buffer = createTransmissionBuffer();
  const onFrame = jest.fn();
  buffer.append(Buffer.alloc(800, 1));
  buffer.flush(onFrame);
  expect(onFrame).not.toHaveBeenCalled();

  buffer.append(Buffer.alloc(800, 2));
  buffer.flush(onFrame);
  expect(onFrame).toHaveBeenCalledTimes(1);
  expect(onFrame.mock.calls[0][0]).toEqual(
    Buffer.concat([Buffer.alloc(800, 1), Buffer.alloc(480, 2)]),
  );
  expect(buffer.length).toBe(320);
});

test("discards incomplete frames or all buffered PCM", () => {
  const buffer = createTransmissionBuffer();
  buffer.append(Buffer.alloc(1400));
  buffer.keepCompleteFrames();
  expect(buffer.length).toBe(1280);
  buffer.clear();
  expect(buffer.length).toBe(0);
});
