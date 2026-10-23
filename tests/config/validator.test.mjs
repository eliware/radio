import { parseEnv } from "node:util";
import { expect, test } from "@jest/globals";
import { validateChannelConfig } from "../../src/config/validator.mjs";

const valid = {
  CHANNEL: "Police",
  USERNAME: "radio",
  PASSWORD: "pw",
  ISSUER: "issuer",
  SDR_SERIAL: "851",
  UDP_PORT: "15581",
  FREQUENCY_MHZ: "155.1",
  CTCSS_HZ: "77.0",
  TONE: "1000",
  PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----abc",
};

test("normalizes optional RNNoise and UDP settings", () => {
  expect(validateChannelConfig({ ...valid }).RNNOISE).toBe("100");
  expect(validateChannelConfig({ ...valid, UDP_PORT: "015581", RNNOISE: "80" })).toMatchObject({
    UDP_PORT: "15581",
    RNNOISE: "80",
  });
});

test.each([
  "TOKEN=sample\n",
  "SDR_SERIAL=bad;include\n",
  "CTCSS_HZ=999\n",
  "PRIVATE_KEY=bad\n",
  "USERNAME=\n",
  "TONE=invalid\n",
  "FREQUENCY_MHZ=invalid\n",
  "UDP_PORT=invalid\n",
  "UDP_PORT=1023\n",
  "UDP_PORT=65536\n",
  "UDP_PORT=15581.5\n",
  "RNNOISE=invalid\n",
  "RNNOISE=-1\n",
  "RNNOISE=101\n",
])("rejects unsafe or invalid settings: %s", (patch) =>
  expect(() => validateChannelConfig({ ...valid, ...parseEnv(patch) })).toThrow(),
);
