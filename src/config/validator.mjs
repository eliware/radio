const ranges = { FREQUENCY_MHZ: [24, 1766], CTCSS_HZ: [67, 254.1], TONE: [200, 3000] };

function required(values, name) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function validateChannelConfig(values) {
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
