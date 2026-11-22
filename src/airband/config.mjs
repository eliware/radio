import serializeAirbandConfig from "./serializer.mjs";
import validateAirbandChannels from "./validate-channels.mjs";

export default function createAirbandConfig(channels) {
  validateAirbandChannels(channels);
  return serializeAirbandConfig(channels);
}
