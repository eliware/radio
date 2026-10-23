import { createLogger, defaultPolicy } from "@eliware/common";
import { knownSecrets, redactErrorText } from "./logging/error-details.mjs";
import { sanitizeMetadata } from "./logging/metadata.mjs";

const privateKeys = [
  ...defaultPolicy.keys,
  "password",
  "private_key",
  "public_key",
  "issuer",
  "auth_token",
  "api_key",
];
const supportedLevels = new Set(["debug", "info", "warn", "error"]);

function validateLevel(level) {
  const normalized = String(level).toLowerCase();
  if (!supportedLevels.has(normalized))
    throw new Error(`Invalid LOG_LEVEL: ${normalized}. Use debug, info, warn, or error.`);
  return normalized;
}

export function createRadioLogger({
  level = String(process.env.LOG_LEVEL ?? "info").toLowerCase(),
  secrets = knownSecrets,
  createLoggerImpl = createLogger,
} = {}) {
  const base = createLoggerImpl({
    level: validateLevel(level),
    format: "json",
    timestamp: true,
    keys: privateKeys,
  });
  const methods = ["debug", "info", "warn", "error"];
  return Object.fromEntries(
    methods.map((method) => [
      method,
      (message, metadata = {}) =>
        base[method](
          redactErrorText(message, secrets),
          sanitizeMetadata(metadata, secrets, privateKeys),
        ),
    ]),
  );
}

export const logger = createRadioLogger({ secrets: knownSecrets });
