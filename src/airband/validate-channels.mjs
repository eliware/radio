export default function validateAirbandChannels(channels) {
  if (channels.length === 0) throw new Error("At least one channel is required");
  if (
    channels.some(
      ({ SDR_SERIAL }) => typeof SDR_SERIAL !== "string" || !/^[a-zA-Z0-9_-]+$/.test(SDR_SERIAL),
    )
  )
    throw new Error("SDR_SERIAL is invalid");
  if (new Set(channels.map(({ UDP_PORT }) => UDP_PORT)).size !== channels.length)
    throw new Error("Channels need distinct UDP ports");
  const groups = Map.groupBy(channels, ({ SDR_SERIAL }) => SDR_SERIAL);
  for (const [serial, group] of groups) {
    const frequencies = group.map(({ FREQUENCY_MHZ }) => Number(FREQUENCY_MHZ));
    if (frequencies.some((frequency) => !Number.isFinite(frequency)))
      throw new Error(`Channels on SDR ${serial} need finite frequencies`);
    if (Math.max(...frequencies) - Math.min(...frequencies) > 2.4)
      throw new Error(`Channels on SDR ${serial} must fit within a 2.4 MHz band`);
    const gainValues = group.map(({ SDR_GAIN }) => Number(SDR_GAIN ?? 10));
    if (gainValues.some((gain) => !Number.isFinite(gain)))
      throw new Error(`Channels on SDR ${serial} need finite SDR_GAIN values`);
    const gains = new Set(gainValues);
    if (gains.size > 1) throw new Error(`Channels on SDR ${serial} must use the same SDR_GAIN`);
  }
  return channels;
}
