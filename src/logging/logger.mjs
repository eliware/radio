import { createLogger } from "@eliware/common";
import { knownSecrets } from "./secrets.mjs";
import { createSanitizedLogger, privateKeys } from "./log-record.mjs";

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
  return createSanitizedLogger(base, secrets);
}
