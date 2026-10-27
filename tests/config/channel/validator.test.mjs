import { parseEnv } from "node:util";
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

test.each([
  "TOKEN=sample\n",
  "SDR_SERIAL=bad;include\n",
  'SDR_SERIAL=851"; gain = 0; #\n',
  "SDR_SERIAL=851\\; gain = 0; #\n",
  "CTCSS_HZ=999\n",
  "CTCSS_HZ=66\n",
  "FREQUENCY_MHZ=23\n",
  "FREQUENCY_MHZ=invalid\n",
  "PRIVATE_KEY=bad\n",
  "USERNAME=\n",
  "UDP_PORT=invalid\n",
  "UDP_PORT=1023\n",
  "UDP_PORT=65536\n",
  "UDP_PORT=15581.5\n",
  "SDR_GAIN=invalid\n",
  "SDR_GAIN=-1\n",
  "SDR_GAIN=49.7\n",
])("rejects invalid channel or receiver settings: %s", (patch) =>
  expect(() => validateChannelSettings({ ...valid, ...parseEnv(patch) })).toThrow(),
);

test("defaults SDR gain to 10 dB", () => {
  const settings = { ...valid };
  delete settings.SDR_GAIN;
  expect(validateChannelSettings(settings).SDR_GAIN).toBe("10");
});
