import { createLogger } from "@eliware/common";
import { knownSecrets } from "./secrets.mjs";
import createSanitizedLogger, { privateKeys } from "./log-record.mjs";
import validateLogLevel from "./level.mjs";

export default function createRadioLogger({
  level = String(process.env.LOG_LEVEL ?? "info").toLowerCase(),
  secrets = knownSecrets,
  createLoggerImpl = createLogger,
} = {}) {
  const base = createLoggerImpl({
    level: validateLogLevel(level),
    format: "json",
    timestamp: true,
    keys: privateKeys,
  });
  return createSanitizedLogger(base, secrets);
}
