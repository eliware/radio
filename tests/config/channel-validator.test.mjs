import { parseEnv } from "node:util";
import { expect, test } from "@jest/globals";
import { validateChannelSettings } from "../../src/config/channel-validator.mjs";

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

test("validates channel credentials and normalizes the UDP port", () => {
  expect(validateChannelSettings({ ...valid, UDP_PORT: "015581" }).UDP_PORT).toBe("15581");
});

test.each([
  "TOKEN=sample\n",
  "SDR_SERIAL=bad;include\n",
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
])("rejects invalid channel or receiver settings: %s", (patch) =>
  expect(() => validateChannelSettings({ ...valid, ...parseEnv(patch) })).toThrow(),
);
