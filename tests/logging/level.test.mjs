import { expect, test } from "@jest/globals";
import validateLogLevel from "../../src/logging/level.mjs";

test.each(["debug", "info", "warn", "error"])("accepts the %s log level", (level) => {
  expect(validateLogLevel(level)).toBe(level);
});

test("normalizes supported log levels", () => {
  expect(validateLogLevel("DEBUG")).toBe("debug");
});

test("rejects unsupported logger levels", () => {
  expect(() => validateLogLevel("unknown")).toThrow(
    "Invalid LOG_LEVEL: unknown. Use debug, info, warn, or error.",
  );
});
