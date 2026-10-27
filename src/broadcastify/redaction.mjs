export function redactBroadcastifyText(text, mount) {
  if (mount) text = text.replaceAll(mount, "/[redacted]");
  return text.replace(/icecast:\/\/[^\s'"|]+/g, "icecast://[redacted]");
}
