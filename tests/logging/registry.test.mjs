import { expect, test } from "@jest/globals";
import createSecretRegistry from "../../src/logging/registry.mjs";

test("keeps shared secrets registered until each owner releases them", () => {
  const knownSecrets = [];
  const registerSecrets = createSecretRegistry(knownSecrets);
  const releaseFirst = registerSecrets(["shared", "private"]);
  const releaseSecond = registerSecrets(["shared"]);
  expect(knownSecrets).toEqual(["shared", "private"]);
  releaseFirst();
  expect(knownSecrets).toEqual(["shared"]);
  releaseSecond();
  expect(knownSecrets).toEqual([]);
});
