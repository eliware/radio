import { expect, jest, test } from "@jest/globals";
import releaseSecretsAndRedact from "../../src/logging/release-secrets-and-redact.mjs";

test("redacts an error before releasing secrets", () => {
  const releaseSecrets = jest.fn();
  const result = releaseSecretsAndRedact(releaseSecrets, new Error("failed"));
  expect(result.message).toBe("failed");
  expect(releaseSecrets).toHaveBeenCalledTimes(1);
});
