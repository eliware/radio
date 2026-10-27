export function validateAirbandChannels(channels) {
  if (channels.length !== 2 || channels[0].SDR_SERIAL === channels[1].SDR_SERIAL) {
    throw new Error("Two channels need distinct SDR serials");
  }
  if (channels[0].UDP_PORT === channels[1].UDP_PORT) {
    throw new Error("Two channels need distinct UDP ports");
  }
  return channels;
}

export function createAirbandConfig(channels) {
  validateAirbandChannels(channels);
  const devices = channels.map((channel) => {
    const frequency = Number(channel.FREQUENCY_MHZ).toFixed(4);
    const tone = Number(channel.CTCSS_HZ).toFixed(1);
    const gain = Number(channel.SDR_GAIN ?? 10);
    return `{ type = "rtlsdr"; serial = "${channel.SDR_SERIAL}"; gain = ${gain};
      sample_rate = 1.024; centerfreq = ${frequency}; channels: ({ freq = ${frequency};
      modulation = "nfm"; ctcss = ${tone}; notch = ${tone}; bandwidth = 8000;
      tau = 300; outputs: ({
      type = "udp_stream"; dest_address = "127.0.0.1"; dest_port = ${channel.UDP_PORT};
      continuous = false; }); }); }`;
  });
  return `fft_size = 256; devices: (${devices.join(",")});`;
}
