const supportedLevels = new Set(["debug", "info", "warn", "error"]);

export function validateLogLevel(level) {
  const normalized = String(level).toLowerCase();
  if (!supportedLevels.has(normalized))
    throw new Error(`Invalid LOG_LEVEL: ${normalized}. Use debug, info, warn, or error.`);
  return normalized;
}
