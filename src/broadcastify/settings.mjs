const required = (values, key) => {
  const value = values[key]?.trim();
  if (!value) throw new Error(`${key} must be set when Broadcastify is enabled`);
  return value;
};

export function getBroadcastifySettings(values) {
  const enabled = values.BROADCASTIFY_ENABLED ?? "false";
  if (!["true", "false"].includes(enabled))
    throw new Error("BROADCASTIFY_ENABLED must be true or false");
  if (enabled === "false") return { enabled: false };
  const host = required(values, "BROADCASTIFY_HOST");
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) throw new Error("BROADCASTIFY_HOST is invalid");
  const port = Number(required(values, "BROADCASTIFY_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("BROADCASTIFY_PORT must be an integer from 1 to 65535");
  const mount = required(values, "BROADCASTIFY_MOUNT");
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(mount)) throw new Error("BROADCASTIFY_MOUNT is invalid");
  return {
    enabled: true,
    host,
    port,
    mount,
    password: required(values, "BROADCASTIFY_PASSWORD"),
    name: values.BROADCASTIFY_NAME?.trim() || values.CHANNEL,
  };
}
