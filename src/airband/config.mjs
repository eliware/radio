import { serializeAirbandConfig } from "./serializer.mjs";

export function validateAirbandChannels(channels) {
  if (channels.length === 0) throw new Error("At least one channel is required");
  if (new Set(channels.map(({ UDP_PORT }) => UDP_PORT)).size !== channels.length)
    throw new Error("Channels need distinct UDP ports");
  const groups = Map.groupBy(channels, ({ SDR_SERIAL }) => SDR_SERIAL);
  for (const [serial, group] of groups) {
    const frequencies = group.map(({ FREQUENCY_MHZ }) => Number(FREQUENCY_MHZ));
    if (Math.max(...frequencies) - Math.min(...frequencies) > 2.4)
      throw new Error(`Channels on SDR ${serial} must fit within a 2.4 MHz band`);
    const gains = new Set(group.map(({ SDR_GAIN }) => Number(SDR_GAIN ?? 10)));
    if (gains.size > 1) throw new Error(`Channels on SDR ${serial} must use the same SDR_GAIN`);
  }
  return channels;
}

export function createAirbandConfig(channels) {
  validateAirbandChannels(channels);
  return serializeAirbandConfig(channels);
}
