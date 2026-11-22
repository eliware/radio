import { expect, test } from "@jest/globals";
import redactError from "../../src/logging/safe-error.mjs";
import releaseSecretsAndRedact from "../../src/logging/release-secrets-and-redact.mjs";
import rememberSecrets from "../../src/logging/secrets.mjs";

test("redacts error message and stack while retaining its name", () => {
  const release = rememberSecrets([{ TOKEN: "private-token" }]);
  const original = new TypeError("failed with private-token");
  const safeError = redactError(original);
  expect(safeError.name).toBe("TypeError");
  expect(safeError.message).toBe("failed with [REDACTED]");
  expect(safeError.stack).not.toContain("private-token");
  release();
});

test("redacts before releasing known secrets", () => {
  const release = rememberSecrets([{ TOKEN: "private-token" }]);
  const safeError = releaseSecretsAndRedact(release, new Error("private-token"));
  expect(safeError.message).toBe("[REDACTED]");
});
