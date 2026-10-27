import { expect, test } from "@jest/globals";
import { knownSecrets, rememberSecrets } from "../../src/logging/secrets.mjs";

test("registers credentials and releases them when a runtime ends", () => {
  const release = rememberSecrets([
    {
      PASSWORD: "password-secret",
      PRIVATE_KEY: "key-secret",
      TOKEN: "token-secret",
      BROADCASTIFY_PASSWORD: "broadcastify-secret",
    },
  ]);
  expect(knownSecrets).toEqual([
    "password-secret",
    "key-secret",
    "token-secret",
    "broadcastify-secret",
  ]);
  release();
  release();
  expect(knownSecrets).not.toContain("password-secret");
});

test("keeps a secret registered until all owners release it", () => {
  const firstRelease = rememberSecrets([{ PASSWORD: "shared-secret" }]);
  const secondRelease = rememberSecrets([{ PASSWORD: "shared-secret" }]);
  firstRelease();
  expect(knownSecrets).toContain("shared-secret");
  secondRelease();
  expect(knownSecrets).not.toContain("shared-secret");
});
