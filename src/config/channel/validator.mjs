import validateChannelCredentials from "./credentials.mjs";
import validateSdrSettings from "./sdr.mjs";

const requiredFields = [
  "CHANNEL",
  "USERNAME",
  "PASSWORD",
  "ISSUER",
  "PRIVATE_KEY",
  "SDR_SERIAL",
  "UDP_PORT",
];
const allowedFields = new Set([
  ...requiredFields,
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

export default function validateChannelSettings(values) {
  const unknown = Object.keys(values).find((name) => !allowedFields.has(name));
  if (unknown) throw new Error(`${unknown} is not a supported channel setting`);
  validateChannelCredentials(values);
  validateSdrSettings(values);
  return values;
}
