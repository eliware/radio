import { expect, test } from "@jest/globals";
import serializeAirbandConfig from "../../src/airband/serializer.mjs";

test("serializes devices and channel feeds for RTLSDR-Airband", () => {
  const base = {
    SDR_SERIAL: "851",
    SDR_GAIN: "10",
    UDP_PORT: "15581",
    FREQUENCY_MHZ: "155.1",
    CTCSS_HZ: "77.0",
  };
  const config = serializeAirbandConfig([
    base,
    { ...base, SDR_SERIAL: "853", UDP_PORT: "15422", FREQUENCY_MHZ: "154.2" },
  ]);
  expect(config).toContain('serial = "851"');
  expect(config).toContain('serial = "853"');
  expect(config).toContain("gain = 10");
  expect(config).toContain("centerfreq = 155.1000");
  expect(config).toContain("dest_port = 15581");
  expect(config).toContain("dest_port = 15422");
  expect(config).toContain("continuous = false");
});

test("uses the default tuner gain and centers shared-channel devices", () => {
  const channel = {
    SDR_SERIAL: "851",
    UDP_PORT: "15581",
    FREQUENCY_MHZ: "155.1",
    CTCSS_HZ: "77.0",
  };
  const config = serializeAirbandConfig([
    channel,
    { ...channel, UDP_PORT: "15422", FREQUENCY_MHZ: "155.5" },
  ]);
  expect(config.match(/serial = "851"/g)).toHaveLength(1);
  expect(config).toContain("gain = 10");
  expect(config).toContain("centerfreq = 155.3000");
  expect(config).toContain("freq = 155.5000");
});
