import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const ranges = { FREQUENCY_MHZ: [24, 1766], CTCSS_HZ: [67, 254.1], TONE: [200, 3000] };

function required(values, name) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

function validate(values) {
  for (const name of [
    "CHANNEL",
    "USERNAME",
    "PASSWORD",
    "ISSUER",
    "PRIVATE_KEY",
    "SDR_SERIAL",
    "UDP_PORT",
    "TONE",
  ]) {
    required(values, name);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(values.SDR_SERIAL)) throw new Error("SDR_SERIAL is invalid");
  for (const [name, [min, max]] of Object.entries(ranges)) {
    const value = Number(required(values, name));
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(`${name} is invalid`);
  }
  const udpPort = Number(required(values, "UDP_PORT"));
  if (!Number.isInteger(udpPort) || udpPort < 1024 || udpPort > 65535)
    throw new Error("UDP_PORT must be an integer from 1024 to 65535");
  values.UDP_PORT = String(udpPort);
  const rnnoise = Number(values.RNNOISE ?? 100);
  if (!Number.isInteger(rnnoise) || rnnoise < 0 || rnnoise > 100)
    throw new Error("RNNOISE must be an integer from 0 to 100");
  values.RNNOISE = String(rnnoise);
  if (!values.PRIVATE_KEY.includes("BEGIN PRIVATE KEY")) throw new Error("PRIVATE_KEY must be PEM");
  if (values.TOKEN) throw new Error("Remove TOKEN; use issuer and private key for production auth");
  return values;
}

export async function loadChannelConfig(path, read = readFile) {
  return validate(parseEnv(await read(path, "utf8")));
}

export function createAirbandConfig(channels) {
  if (channels.length !== 2 || channels[0].SDR_SERIAL === channels[1].SDR_SERIAL) {
    throw new Error("Two channels need distinct SDR serials");
  }
  if (channels[0].UDP_PORT === channels[1].UDP_PORT) {
    throw new Error("Two channels need distinct UDP ports");
  }
  const devices = channels.map((channel) => {
    const frequency = Number(channel.FREQUENCY_MHZ).toFixed(4);
    const tone = Number(channel.CTCSS_HZ).toFixed(1);
    return `{ type = "rtlsdr"; serial = "${channel.SDR_SERIAL}"; gain = 20;
      sample_rate = 1.024; centerfreq = ${frequency}; channels: ({ freq = ${frequency};
      modulation = "nfm"; ctcss = ${tone}; notch = ${tone}; bandwidth = 8000;
      tau = 300; outputs: ({
      type = "udp_stream"; dest_address = "127.0.0.1"; dest_port = ${channel.UDP_PORT};
      continuous = false; }); }); }`;
  });
  return `fft_size = 256; devices: (${devices.join(",")});`;
}
