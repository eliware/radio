import { expect, test } from "@jest/globals";
import validateChannelFields from "../../../src/config/channel/fields.mjs";

test("accepts known channel settings", () => {
  const values = { CHANNEL: "Police", PRIVATE_KEY: "private key" };
  expect(validateChannelFields(values)).toBe(values);
});

test("rejects unknown settings so unrecognized credentials cannot pass validation", () => {
  expect(() => validateChannelFields({ CHANNEL: "Police", PRIVATE_TOKEN: "secret-value" })).toThrow(
    "PRIVATE_TOKEN is not a supported channel setting",
  );
});
