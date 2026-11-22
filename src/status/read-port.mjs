export default function readStatusPort(value = process.env.RADIO_HEALTH_PORT ?? 1400) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("RADIO_HEALTH_PORT must be an integer from 0 to 65535");
  return port;
}
