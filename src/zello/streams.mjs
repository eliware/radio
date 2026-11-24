import codecHeader from "../audio/codec.mjs";
import { logger } from "../logger.mjs";
import sanitizeMetadata from "../logging/metadata.mjs";
import { privateKeys } from "../logging/log-record.mjs";
import { knownSecrets } from "../logging/secrets.mjs";

export default function createZelloStreams(
  channel,
  diagnoseResponseValues = process.env.RADIO_ZELLO_DEBUG_RESPONSES === "true",
  log = logger,
  now = Date.now,
) {
  let request;
  let lastInvalidResponseLogAt = 0;
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
      if (diagnoseResponseValues && now() - lastInvalidResponseLogAt >= 60000) {
        lastInvalidResponseLogAt = now();
        log.error("Zello start_stream returned an invalid stream_id", {
          channel,
          response: sanitizeMetadata(response, knownSecrets, privateKeys),
          streamIdType:
            streamId === null ? "null" : Array.isArray(streamId) ? "array" : typeof streamId,
        });
      }
      throw new Error("Zello start_stream returned an invalid stream_id");
    },
    async stopStream(streamId) {
      await request({ command: "stop_stream", channel, stream_id: streamId });
    },
  };
}
