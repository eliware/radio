import { knownSecrets } from "../logging/secrets.mjs";
import { redactErrorText } from "../logging/error-details.mjs";
import { redactBroadcastifyText } from "./redaction.mjs";

export function sanitizeBroadcastifyStderr(stderr, settings) {
  const detail = stderr.trim().split("\n").slice(-12).join(" | ");
  const secrets = [...knownSecrets, settings.password].filter(Boolean);
  return redactBroadcastifyText(redactErrorText(detail, secrets), settings.mount);
}
