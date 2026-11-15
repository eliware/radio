import { expect, test } from "@jest/globals";
import { createAirbandConfig, validateAirbandChannels } from "../../src/airband/config.mjs";

const base = {
  SDR_SERIAL: "851",
  SDR_GAIN: "10",
  UDP_PORT: "15581",
  FREQUENCY_MHZ: "155.1",
  CTCSS_HZ: "77.0",
};

test("validates non-empty channels, unique ports, shared band, and shared tuner gain", () => {
  const sharedDongle = [base, { ...base, UDP_PORT: "15422", FREQUENCY_MHZ: "155.5" }];
  expect(validateAirbandChannels(sharedDongle)).toBe(sharedDongle);
  expect(() => validateAirbandChannels([])).toThrow("At least one channel is required");
  expect(() => validateAirbandChannels([base, base])).toThrow("distinct UDP ports");
  expect(() =>
    validateAirbandChannels([base, { ...base, UDP_PORT: "15422", FREQUENCY_MHZ: "157.6" }]),
  ).toThrow("2.4 MHz band");
  expect(() =>
    validateAirbandChannels([base, { ...base, UDP_PORT: "15422", SDR_GAIN: "15" }]),
  ).toThrow("same SDR_GAIN");
});

test("creates config only after channel validation", () => {
  expect(createAirbandConfig([base])).toMatch(/^fft_size = 256;/);
  expect(() => createAirbandConfig([base, base])).toThrow("distinct UDP ports");
});

test("rejects non-finite channel frequencies and tuner gains", () => {
  expect(() => validateAirbandChannels([{ ...base, FREQUENCY_MHZ: "NaN" }])).toThrow(
    "finite frequencies",
  );
  expect(() => createAirbandConfig([{ ...base, SDR_GAIN: "Infinity" }])).toThrow(
    "finite SDR_GAIN values",
  );
});
