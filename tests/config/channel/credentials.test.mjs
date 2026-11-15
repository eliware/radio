import { parseEnv } from "node:util";
import { expect, test } from "@jest/globals";
import { validateChannelCredentials } from "../../../src/config/channel/credentials.mjs";

const valid = {
  CHANNEL: "Police",
  USERNAME: "radio",
  PASSWORD: "pw",
  ISSUER: "issuer",
  PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----abc",
};

test.each(["TOKEN=sample\n", "PRIVATE_KEY=bad\n"])("rejects invalid credentials: %s", (patch) =>
  expect(() => validateChannelCredentials({ ...valid, ...parseEnv(patch) })).toThrow(),
);

test("accepts complete production credentials", () => {
  expect(validateChannelCredentials({ ...valid })).toBeUndefined();
});
