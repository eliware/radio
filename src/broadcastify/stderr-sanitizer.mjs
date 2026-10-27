export function sanitizeBroadcastifyStderr(stderr, settings) {
  let detail = stderr.trim().split("\n").slice(-12).join(" | ");
  if (settings.password) detail = detail.replaceAll(settings.password, "[redacted]");
  if (settings.mount) detail = detail.replaceAll(settings.mount, "/[redacted]");
  return detail.replace(/icecast:\/\/[^\s'"|]+/g, "icecast://[redacted]");
}
