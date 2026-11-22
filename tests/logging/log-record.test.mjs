import { expect, test } from "@jest/globals";
import createSanitizedLogger, { privateKeys } from "../../src/logging/log-record.mjs";

test("redacts secrets from log messages and nested metadata", () => {
  const records = [];
  const base = Object.fromEntries(
    ["debug", "info", "warn", "error"].map((level) => [
      level,
      (message, metadata) => records.push({ level, message, metadata }),
    ]),
  );
  const logger = createSanitizedLogger(base, ["literal-secret", "line one\nline two"]);
  logger.info("literal-secret", {
    password: "hidden",
    note: "literal-secret",
    nested: ["line one\nline two", 7],
  });

  expect(records[0]).toEqual({
    level: "info",
    message: "[REDACTED]",
    metadata: {
      password: "[REDACTED]",
      note: "[REDACTED]",
      nested: ["[REDACTED]", 7],
    },
  });
});

test("includes application credential names in the private key policy", () => {
  expect(privateKeys).toEqual(
    expect.arrayContaining([
      "password",
      "private_key",
      "public_key",
      "issuer",
      "auth_token",
      "api_key",
    ]),
  );
});
