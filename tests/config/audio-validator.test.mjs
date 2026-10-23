import { parseEnv } from "node:util";
import { expect, test } from "@jest/globals";
import { validateAudioSettings } from "../../src/config/audio-validator.mjs";

test("validates tone and defaults or normalizes RNNoise strength", () => {
  expect(validateAudioSettings({ TONE: "1000" }).RNNOISE).toBe("100");
  expect(validateAudioSettings({ TONE: "1300", RNNOISE: "080" })).toMatchObject({
    TONE: "1300",
    RNNOISE: "80",
  });
});

test("requires a tone frequency", () => {
  expect(() => validateAudioSettings({})).toThrow("TONE must be set");
});

test.each([
  { TONE: "" },
  { TONE: "invalid" },
  { TONE: "199" },
  { TONE: "3001" },
  { TONE: "1000", RNNOISE: "invalid" },
  { TONE: "1000", RNNOISE: "-1" },
  { TONE: "1000", RNNOISE: "101" },
])("rejects invalid audio settings: %s", (patch) =>
  expect(() => validateAudioSettings({ TONE: "1000", ...patch })).toThrow(),
);

test("parses audio setting values in the shared env format", () => {
  expect(validateAudioSettings(parseEnv("TONE=1100\nRNNOISE=75\n")).RNNOISE).toBe("75");
});
