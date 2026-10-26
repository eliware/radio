import { expect, test } from "@jest/globals";
import { createAirbandConfig } from "../../src/airband/config.mjs";

test("creates one RTLSDR-Airband process config with separate UDP feeds", () => {
  const base = {
    SDR_SERIAL: "851",
    SDR_GAIN: "10",
    UDP_PORT: "15581",
    FREQUENCY_MHZ: "155.1",
    CTCSS_HZ: "77.0",
  };
  const config = createAirbandConfig([
    base,
    { ...base, SDR_SERIAL: "853", UDP_PORT: "15422", FREQUENCY_MHZ: "154.2" },
  ]);
  expect(config).toContain('serial = "851"');
  expect(config).toContain('serial = "853"');
  expect(config).toContain("gain = 10");
  expect(config).toContain("dest_port = 15581");
  expect(config).toContain("dest_port = 15422");
  expect(config).toContain("continuous = false");
  const defaults = createAirbandConfig([
    { ...base, SDR_GAIN: undefined },
    { ...base, SDR_SERIAL: "853", UDP_PORT: "15422", SDR_GAIN: undefined },
  ]);
  expect(defaults).toContain("gain = 10");
  expect(() => createAirbandConfig([base])).toThrow("distinct SDR serials");
  expect(() => createAirbandConfig([base, base])).toThrow("distinct SDR serials");
  expect(() => createAirbandConfig([base, { ...base, SDR_SERIAL: "853" }])).toThrow(
    "distinct UDP ports",
  );
});
