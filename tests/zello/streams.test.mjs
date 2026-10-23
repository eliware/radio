import { expect, jest, test } from "@jest/globals";
import { createZelloStreams } from "../../src/zello/streams.mjs";

test("starts an Opus stream with the configured channel and codec header", async () => {
  const request = jest.fn(async () => ({ stream_id: 23 }));
  const streams = createZelloStreams("PD");
  streams.setRequest(request);
  await expect(streams.startStream()).resolves.toBe(23);
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      command: "start_stream",
      channel: "PD",
      type: "audio",
      codec: "opus",
      packet_duration: 20,
      codec_header: expect.any(String),
    }),
  );
  const header = Buffer.from(request.mock.calls[0][0].codec_header, "base64");
  expect(header.readUInt16LE(0)).toBe(48000);
});

test("accepts non-empty opaque stream identifiers", async () => {
  const streams = createZelloStreams("PD");
  streams.setRequest(async () => ({ stream_id: "stream-23" }));
  await expect(streams.startStream()).resolves.toBe("stream-23");
});

test.each([null, " ", 0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, {}])(
  "rejects invalid stream id %p",
  async (streamId) => {
    const streams = createZelloStreams("PD");
    streams.setRequest(async () => ({ stream_id: streamId }));
    await expect(streams.startStream()).rejects.toThrow("invalid stream_id");
  },
);

test("stops a stream on its configured channel", async () => {
  const request = jest.fn();
  const streams = createZelloStreams("FD");
  streams.setRequest(request);
  await streams.stopStream("fire-stream");
  expect(request).toHaveBeenCalledWith({
    command: "stop_stream",
    channel: "FD",
    stream_id: "fire-stream",
  });
});
