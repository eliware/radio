import { expect, test } from "@jest/globals";
import { errorDetails, redactErrorText } from "../../src/logging/error-details.mjs";
import { knownSecrets, rememberSecrets } from "../../src/logging/secrets.mjs";

test("remembers channel credentials and redacts error messages and stacks", () => {
  const release = rememberSecrets([
    { PASSWORD: "private-pass", PRIVATE_KEY: "private-key", TOKEN: "private-token" },
  ]);
  const result = errorDetails(new Error("failed with private-pass"));
  expect(result.name).toBe("Error");
  expect(result.message).toBe("failed with [REDACTED]");
  expect(result.stack).not.toContain("private-pass");
  expect(errorDetails("private-key").message).toBe("[REDACTED]");
  expect(redactErrorText("private-token")).toBe("[REDACTED]");
  expect(redactErrorText("custom-secret", ["custom-secret"])).toBe("[REDACTED]");
  release();
});

test("ignores empty credentials and preserves ordinary text", () => {
  const release = rememberSecrets([{ PASSWORD: "", PRIVATE_KEY: undefined, TOKEN: null }]);
  expect(knownSecrets).not.toContain("");
  expect(redactErrorText("safe text", [])).toBe("safe text");
  expect(errorDetails("ordinary error")).toMatchObject({
    name: "Error",
    message: "ordinary error",
  });
  release();
});
