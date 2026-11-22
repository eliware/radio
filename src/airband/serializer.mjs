export default function serializeAirbandConfig(channels) {
  const groups = Map.groupBy(channels, ({ SDR_SERIAL }) => SDR_SERIAL);
  const devices = [...groups].map(([serial, group]) => {
    const frequencies = group.map(({ FREQUENCY_MHZ }) => Number(FREQUENCY_MHZ));
    const centerfreq = ((Math.min(...frequencies) + Math.max(...frequencies)) / 2).toFixed(4);
    const gain = Number(group[0].SDR_GAIN ?? 10);
    const entries = group.map((channel) => {
      const frequency = Number(channel.FREQUENCY_MHZ).toFixed(4);
      const tone = Number(channel.CTCSS_HZ).toFixed(1);
      return `{ freq = ${frequency};
      modulation = "nfm"; ctcss = ${tone}; notch = ${tone}; bandwidth = 8000;
      tau = 300; outputs: ({
      type = "udp_stream"; dest_address = "127.0.0.1"; dest_port = ${channel.UDP_PORT};
      continuous = false; }); }`;
    });
    return `{ type = "rtlsdr"; serial = "${serial}"; gain = ${gain};
      sample_rate = 2.56; centerfreq = ${centerfreq}; channels: (${entries.join(",")}); }`;
  });
  return `fft_size = 256; devices: (${devices.join(",")});`;
}
