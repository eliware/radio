import { expect, test } from "@jest/globals";
import { createSdrConfig } from "../src/sdr-config.mjs";

const settings = {
  ICECAST_SOURCE_PASSWORD: "private_password_0123456789",
  RADIO_POLICE_SDR_SERIAL: "853",
  RADIO_POLICE_FREQUENCY_MHZ: "158.8125",
  RADIO_POLICE_PL_HZ: "77.0",
  RADIO_FIRE_SDR_SERIAL: "851",
  RADIO_FIRE_FREQUENCY_MHZ: "154.2200",
  RADIO_FIRE_PL_HZ: "156.7",
};

test("creates isolated NFM receivers with CTCSS and reduced sample rate", () => {
  const config = createSdrConfig(settings);

  expect(config).toContain('serial = "853"');
  expect(config).toContain('serial = "851"');
  expect(config).toContain("sample_rate = 1.024");
  expect(config).toContain("ctcss = 77.0");
  expect(config).toContain("notch = 156.7");
  expect(config).toContain('mountpoint = "police.mp3"');
  expect(config).toContain('mountpoint = "fire.mp3"');
});

test.each([
  [{}, "ICECAST_SOURCE_PASSWORD must be set"],
  [{ ICECAST_SOURCE_PASSWORD: "short" }, "ICECAST_SOURCE_PASSWORD must use at least 16"],
  [{ ...settings, ICECAST_SOURCE_PASSWORD: "bad password value" }, "invalid characters"],
  [{ ...settings, RADIO_POLICE_SDR_SERIAL: "bad serial" }, "invalid characters"],
  [{ ...settings, RADIO_FIRE_SDR_SERIAL: "853" }, "different SDR serials"],
  [{ ...settings, RADIO_POLICE_FREQUENCY_MHZ: "nope" }, "positive number"],
  [{ ...settings, RADIO_POLICE_FREQUENCY_MHZ: "0" }, "positive number"],
  [{ ...settings, RADIO_POLICE_FREQUENCY_MHZ: "20" }, "24 through 1766 MHz"],
  [{ ...settings, RADIO_POLICE_FREQUENCY_MHZ: "1800" }, "24 through 1766 MHz"],
  [{ ...settings, RADIO_POLICE_PL_HZ: "60" }, "67 through 254.1 Hz"],
  [{ ...settings, RADIO_FIRE_PL_HZ: "260" }, "67 through 254.1 Hz"],
])("rejects invalid settings", (env, message) => {
  expect(() => createSdrConfig(env)).toThrow(message);
});

test("creates one-device configurations for separate supervised receivers", () => {
  expect(createSdrConfig(settings, "police")).toContain(
    'devices: ({ type = "rtlsdr"; serial = "853"',
  );
  expect(createSdrConfig(settings, "fire")).toContain(
    'devices: ({ type = "rtlsdr"; serial = "851"',
  );
  expect(() => createSdrConfig(settings, "unknown")).toThrow("Unknown receiver channel");
});
