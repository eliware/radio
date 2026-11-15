import { expect, test } from "@jest/globals";
import { validateChannelSettings } from "../../../src/config/channel/validator.mjs";

const valid = {
  CHANNEL: "Police",
  USERNAME: "radio",
  PASSWORD: "pw",
  ISSUER: "issuer",
  SDR_SERIAL: "851",
  SDR_GAIN: "10",
  UDP_PORT: "15581",
  FREQUENCY_MHZ: "155.1",
  CTCSS_HZ: "77.0",
  PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----abc",
};

test("validates channel credentials and normalizes the UDP port", () => {
  expect(validateChannelSettings({ ...valid, UDP_PORT: "015581" })).toMatchObject({
    UDP_PORT: "15581",
    SDR_GAIN: "10",
  });
});

test("accepts the documented reference-only public key field", () => {
  expect(validateChannelSettings({ ...valid, PUBLIC_KEY: "reference only" })).toMatchObject({
    PUBLIC_KEY: "reference only",
  });
});

test("leaves Broadcastify fields to the channel integration validator", () => {
  expect(validateChannelSettings({ ...valid, BROADCASTIFY_ENABLED: "invalid" })).toMatchObject({
    CHANNEL: "Police",
  });
});

test("rejects unknown settings so unrecognized credentials cannot be logged", () => {
  expect(() => validateChannelSettings({ ...valid, PRIVATE_TOKEN: "secret-value" })).toThrow(
    "PRIVATE_TOKEN is not a supported channel setting",
  );
});
