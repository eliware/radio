import { loadChannelConfig } from "../src/channel-config.mjs";

const source = (patch = "") =>
  `CHANNEL=Police\nUSERNAME=radio\nPASSWORD=pw\nISSUER=issuer\nSDR_SERIAL=851\nUDP_PORT=15581\nFREQUENCY_MHZ=155.1\nCTCSS_HZ=77.0\nTONE=1000\nPRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"\n${patch}`;
const load = (text) => loadChannelConfig("channel.env", async () => text);

test("loads one channel file with a multiline PEM key", async () => {
  expect((await load(source())).PRIVATE_KEY).toContain("BEGIN PRIVATE KEY");
  expect((await load(source("RNNOISE=80\n"))).RNNOISE).toBe("80");
  expect((await load(source())).RNNOISE).toBe("100");
  await expect(loadChannelConfig("test-fixtures/channel.env")).resolves.toHaveProperty(
    "CHANNEL",
    "Test Police",
  );
});
