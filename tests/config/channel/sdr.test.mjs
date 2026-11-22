import { parseEnv } from "node:util";
import { expect, test } from "@jest/globals";
import validateSdrSettings from "../../../src/config/channel/sdr.mjs";

const valid = {
  SDR_SERIAL: "851",
  SDR_GAIN: "10",
  UDP_PORT: "15581",
  FREQUENCY_MHZ: "155.1",
  CTCSS_HZ: "77.0",
};

test.each([
  "SDR_SERIAL=bad;include\n",
  'SDR_SERIAL=851"; gain = 0; #\n',
  "SDR_SERIAL=851\\; gain = 0; #\n",
  "CTCSS_HZ=999\n",
  "CTCSS_HZ=66\n",
  "FREQUENCY_MHZ=23\n",
  "FREQUENCY_MHZ=invalid\n",
  "UDP_PORT=invalid\n",
  "UDP_PORT=1023\n",
  "UDP_PORT=65536\n",
  "UDP_PORT=15581.5\n",
  "SDR_GAIN=invalid\n",
  "SDR_GAIN=-1\n",
  "SDR_GAIN=49.7\n",
])("rejects invalid SDR settings: %s", (patch) =>
  expect(() => validateSdrSettings({ ...valid, ...parseEnv(patch) })).toThrow(),
);

test("normalizes the UDP port and defaults tuner gain", () => {
  const settings = { ...valid, UDP_PORT: "015581" };
  delete settings.SDR_GAIN;
  validateSdrSettings(settings);
  expect(settings).toMatchObject({ UDP_PORT: "15581", SDR_GAIN: "10" });
});

test("requires an SDR setting", () => {
  expect(() => validateSdrSettings({ ...valid, FREQUENCY_MHZ: " " })).toThrow(
    "FREQUENCY_MHZ must be set",
  );
});
