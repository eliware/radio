import { expect, test } from "@jest/globals";
import redactErrorText from "../../src/logging/redact-error-text.mjs";

test("redacts configured secrets from text", () => {
  expect(redactErrorText("private-token", ["private-token"])).toBe("[REDACTED]");
  expect(redactErrorText("ordinary text", [])).toBe("ordinary text");
});
