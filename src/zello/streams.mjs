import { codecHeader } from "../audio/codec.mjs";

export function createZelloStreams(channel) {
  let request;
  return {
    setRequest(nextRequest) {
      request = nextRequest;
    },
    async startStream() {
      const response = await request({
        command: "start_stream",
        channel,
        type: "audio",
        codec: "opus",
        codec_header: codecHeader(),
        packet_duration: 20,
      });
      const streamId = response.stream_id;
      if (
        (typeof streamId === "string" && streamId.trim()) ||
        (Number.isSafeInteger(streamId) && streamId > 0)
      )
        return streamId;
      throw new Error("Zello start_stream returned an invalid stream_id");
    },
    async stopStream(streamId) {
      await request({ command: "stop_stream", channel, stream_id: streamId });
    },
  };
}
