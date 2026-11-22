import { expect, jest, test } from "@jest/globals";
import { knownSecrets } from "../../src/logging/secrets.mjs";
import prepareRadioConfiguration from "../../src/radio/configuration.mjs";

const config = (serial, channel, port) => ({
  CHANNEL: channel,
  USERNAME: "user",
  PASSWORD: "pw",
  ISSUER: "issuer",
  PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
  SDR_SERIAL: serial,
  UDP_PORT: port,
  FREQUENCY_MHZ: "155.1",
  CTCSS_HZ: "77.0",
  TONE: "1000",
});

function defaults(configs) {
  return {
    configPaths: configs.map((_, index) => `channel-${index}`),
    airbandPath: "/tmp/rtl_airband.conf",
    loadConfig: async (path) => configs[Number(path.split("-")[1])],
    loadNoise: async () => ({ frameSize: 480 }),
    writeConfig: async () => {},
    chmodConfig: async () => {},
    log: { error: jest.fn() },
  };
}

test("rejects missing channel files and propagates config loading failures", async () => {
  await expect(prepareRadioConfiguration({ configPaths: [] })).rejects.toThrow(
    "At least one channel configuration file is required",
  );
  await expect(
    prepareRadioConfiguration({
      ...defaults([]),
      configPaths: ["missing"],
      loadConfig: async () => {
        throw new Error("missing config");
      },
    }),
  ).rejects.toThrow("missing config");
});

test("prepares valid configuration, including channels that share one dongle", async () => {
  const configs = [config("851", "PD", "15581"), config("851", "FD", "15422")];
  configs[1].FREQUENCY_MHZ = "155.5";
  const settings = defaults(configs);
  const writeConfig = jest.fn(async () => {});
  const prepared = await prepareRadioConfiguration({ ...settings, writeConfig });
  expect(prepared.configs).toEqual(configs);
  expect(prepared.rnnoise).toMatchObject({ frameSize: 480 });
  expect(writeConfig).toHaveBeenCalledWith(
    "/tmp/rtl_airband.conf",
    expect.stringContaining("fft_size"),
    { mode: 0o600 },
  );
  prepared.reportError(new Error("component failed"));
  expect(settings.log.error).toHaveBeenCalledWith(
    "Radio component failure",
    expect.objectContaining({ error: expect.any(Object) }),
  );
  prepared.releaseSecrets();
});

test("rate-limits repeated component errors and reports a suppression summary", async () => {
  const settings = defaults([config("851", "PD", "15581")]);
  const onError = jest.fn();
  const prepared = await prepareRadioConfiguration({ ...settings, onError });
  const error = new Error("Invalid Zello response");
  prepared.reportError(error);
  prepared.reportError(error);
  expect(onError).toHaveBeenCalledTimes(1);
  jest.useFakeTimers();
  jest.advanceTimersByTime(60000);
  prepared.reportError(error);
  expect(onError).toHaveBeenLastCalledWith(
    expect.objectContaining({
      message: "Repeated error suppressed 1 times: Invalid Zello response",
    }),
  );
  prepared.reportError("plain error");
  for (let index = 0; index < 101; index += 1)
    prepared.reportError(new Error(`unique error ${index}`));
  jest.useRealTimers();
  prepared.releaseSecrets();
});

test("rejects duplicate UDP ports before loading RNNoise", async () => {
  const configs = [config("851", "PD", "15581"), config("853", "FD", "15581")];
  const loadNoise = jest.fn();
  await expect(prepareRadioConfiguration({ ...defaults(configs), loadNoise })).rejects.toThrow(
    "distinct UDP ports",
  );
  expect(loadNoise).not.toHaveBeenCalled();
});

test("redacts config write failures and releases remembered credentials", async () => {
  const settings = defaults([config("851", "PD", "15581")]);
  settings.writeConfig = async () => {
    throw new Error("write failed pw");
  };
  await expect(prepareRadioConfiguration(settings)).rejects.toThrow("write failed [REDACTED]");
  expect(knownSecrets).not.toContain("pw");
});
