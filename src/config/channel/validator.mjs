const ranges = { FREQUENCY_MHZ: [24, 1766], CTCSS_HZ: [67, 254.1] };
const requiredFields = [
  "CHANNEL",
  "USERNAME",
  "PASSWORD",
  "ISSUER",
  "PRIVATE_KEY",
  "SDR_SERIAL",
  "UDP_PORT",
];

function required(values, name) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function validateChannelSettings(values) {
  for (const name of requiredFields) required(values, name);
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
  const gain = Number(values.SDR_GAIN ?? 10);
  if (!Number.isFinite(gain) || gain < 0 || gain > 49.6)
    throw new Error("SDR_GAIN must be a number from 0 to 49.6 dB");
  values.SDR_GAIN = String(gain);
  if (!values.PRIVATE_KEY.includes("BEGIN PRIVATE KEY")) throw new Error("PRIVATE_KEY must be PEM");
  if (values.TOKEN) throw new Error("Remove TOKEN; use issuer and private key for production auth");
  return values;
}
