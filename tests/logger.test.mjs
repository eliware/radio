import { expect, test } from "@jest/globals";
import { createRadioLogger } from "../src/logger.mjs";

test("creates structured log records with key and literal secret redaction", () => {
  const records = [];
  const createLoggerImpl = (options) => {
    expect(options).toMatchObject({ level: "debug", format: "json", timestamp: true });
    return Object.fromEntries(
      ["debug", "info", "warn", "error"].map((level) => [
        level,
        (message, metadata) => records.push({ level, message, metadata }),
      ]),
    );
  };
  const logger = createRadioLogger({
    level: "DEBUG",
    secrets: ["literal-secret", "line one\nline two"],
    createLoggerImpl,
  });
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
  for (const level of ["debug", "warn", "error"]) logger[level]("event");
  expect(records).toHaveLength(4);
});

test("rejects unsupported logger levels", () => {
  expect(() => createRadioLogger({ level: "unknown" })).toThrow(
    "Invalid LOG_LEVEL: unknown. Use debug, info, warn, or error.",
  );
});

test("uses the configured default logger level for ordinary log calls", () => {
  const records = [];
  const createLoggerImpl = (options) => {
    records.push(options);
    return Object.fromEntries(["debug", "info", "warn", "error"].map((level) => [level, () => {}]));
  };
  createRadioLogger({ createLoggerImpl }).info("ready");
  expect(records[0].level).toBe("info");
});

test("constructs the default production logger", () => {
  expect(createRadioLogger()).toEqual(
    expect.objectContaining({ debug: expect.any(Function), info: expect.any(Function) }),
  );
});
