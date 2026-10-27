import { expect, test } from "@jest/globals";
import { validateChannelBroadcastifySettings } from "../../../src/config/channel/broadcastify.mjs";

const valid = {
  CHANNEL: "Police",
  USERNAME: "radio",
  PASSWORD: "pw",
  ISSUER: "issuer",
  SDR_SERIAL: "851",
  UDP_PORT: "15581",
  FREQUENCY_MHZ: "155.1",
  CTCSS_HZ: "77.0",
  PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----abc",
};

test("validates Broadcastify settings alongside channel settings", () => {
  expect(() =>
    validateChannelBroadcastifySettings({ ...valid, BROADCASTIFY_ENABLED: "invalid" }),
  ).toThrow("BROADCASTIFY_ENABLED must be true or false");
  expect(
    validateChannelBroadcastifySettings({ ...valid, BROADCASTIFY_ENABLED: "false" }),
  ).toMatchObject({ CHANNEL: "Police", UDP_PORT: "15581", SDR_GAIN: "10" });
});
