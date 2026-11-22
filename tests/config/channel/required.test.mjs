import { expect, test } from "@jest/globals";
import validateRequiredChannelCredentials from "../../../src/config/channel/required.mjs";

const valid = {
  CHANNEL: "Police",
  USERNAME: "radio",
  PASSWORD: "pw",
  ISSUER: "issuer",
  PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----abc",
};

test.each(Object.keys(valid))("requires %s", (key) => {
  expect(() => validateRequiredChannelCredentials({ ...valid, [key]: " " })).toThrow(
    `${key} must be set`,
  );
});

test("accepts complete required credentials", () => {
  expect(validateRequiredChannelCredentials(valid)).toBeUndefined();
});
