import { createLogger, defaultPolicy, redactText, safeSerialize } from "@eliware/common";
import { knownSecrets, redactErrorText } from "./logging/error-details.mjs";

const privateKeys = [
  ...defaultPolicy.keys,
  "password",
  "private_key",
  "public_key",
  "issuer",
  "auth_token",
  "api_key",
];

export function createRadioLogger({
  level = String(process.env.LOG_LEVEL ?? "info").toLowerCase(),
  secrets = knownSecrets,
  createLoggerImpl = createLogger,
} = {}) {
  const base = createLoggerImpl({
    level: String(level).toLowerCase(),
    format: "json",
    timestamp: true,
    keys: privateKeys,
  });
  const methods = ["debug", "info", "warn", "error"];
  return Object.fromEntries(
    methods.map((method) => [
      method,
      (message, metadata = {}) =>
        base[method](redactErrorText(message, secrets), safeMetadata(metadata, secrets)),
    ]),
  );
}

function safeMetadata(metadata, secrets) {
  const bounded = safeSerialize(metadata, { keys: privateKeys });
  return redactStrings(bounded, secrets);
}

function redactStrings(value, secrets) {
  if (typeof value === "string") return redactText(value, { secrets });
  if (Array.isArray(value)) return value.map((item) => redactStrings(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactStrings(item, secrets)]),
    );
  }
  return value;
}

export const logger = createRadioLogger({ secrets: knownSecrets });
