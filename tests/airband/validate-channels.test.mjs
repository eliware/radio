import { expect, test } from "@jest/globals";
import validateAirbandChannels from "../../src/airband/validate-channels.mjs";

test("accepts a valid channel configuration", () => {
  const channels = [
    {
      SDR_SERIAL: "851",
      SDR_GAIN: "10",
      UDP_PORT: "15581",
      FREQUENCY_MHZ: "155.1",
    },
  ];
  expect(validateAirbandChannels(channels)).toBe(channels);
});
