import { createAirbandConfig, loadChannelConfig } from "../src/channel-config.mjs";

const source = (patch = "") =>
  `CHANNEL=Police\nUSERNAME=radio\nPASSWORD=pw\nISSUER=issuer\nSDR_SERIAL=851\nFREQUENCY_MHZ=155.1\nCTCSS_HZ=77.0\nTONE=1000\nPRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"\n${patch}`;
const load = (text) => loadChannelConfig("channel.env", async () => text);

test("loads one channel file with a multiline PEM key", async () => {
  expect((await load(source())).PRIVATE_KEY).toContain("BEGIN PRIVATE KEY");
  await expect(loadChannelConfig("test-fixtures/channel.env")).resolves.toHaveProperty(
    "CHANNEL",
    "Test Police",
  );
});

test.each([
  "TOKEN=sample\n",
  "SDR_SERIAL=bad;include\n",
  "CTCSS_HZ=999\n",
  "PRIVATE_KEY=bad\n",
  "USERNAME=\n",
  "TONE=invalid\n",
])("rejects unsafe or invalid settings: %s", (patch) =>
  expect(load(source(patch))).rejects.toThrow(),
);

test("creates one RTLSDR-Airband process config with separate UDP feeds", () => {
  const base = { SDR_SERIAL: "851", FREQUENCY_MHZ: "155.1", CTCSS_HZ: "77.0" };
  const config = createAirbandConfig([
    base,
    { ...base, SDR_SERIAL: "853", FREQUENCY_MHZ: "154.2" },
  ]);
  expect(config).toContain('serial = "851"');
  expect(config).toContain('serial = "853"');
  expect(config).toContain("dest_port = 12001");
  expect(config).toContain("dest_port = 12002");
  expect(config).toContain("continuous = false");
  expect(() => createAirbandConfig([base])).toThrow("distinct SDR serials");
  expect(() => createAirbandConfig([base, base])).toThrow("distinct SDR serials");
});
