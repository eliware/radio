const supportedFields = new Set([
  "CHANNEL",
  "USERNAME",
  "PASSWORD",
  "ISSUER",
  "PRIVATE_KEY",
  "SDR_SERIAL",
  "UDP_PORT",
  "FREQUENCY_MHZ",
  "CTCSS_HZ",
  "SDR_GAIN",
  "TONE",
  "RNNOISE",
  "TOKEN",
  "BROADCASTIFY_ENABLED",
  "BROADCASTIFY_HOST",
  "BROADCASTIFY_PORT",
  "BROADCASTIFY_MOUNT",
  "BROADCASTIFY_PASSWORD",
  "BROADCASTIFY_NAME",
  "PUBLIC_KEY",
]);

export default function validateChannelFields(values) {
  const unknown = Object.keys(values).find((name) => !supportedFields.has(name));
  if (unknown) throw new Error(`${unknown} is not a supported channel setting`);
  return values;
}
