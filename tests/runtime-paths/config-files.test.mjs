import { expect, test } from "@jest/globals";
import getRadioConfigFiles from "../../src/runtime-paths/config-files.mjs";

test("parses a configured list and falls back to the default path", () => {
  expect(
    getRadioConfigFiles({ RADIO_CONFIG_FILES: '["/run/radio/a.env", "/run/radio/b.env"]' }, ".env"),
  ).toEqual(["/run/radio/a.env", "/run/radio/b.env"]);
  expect(getRadioConfigFiles({}, ".env")).toEqual([".env"]);
});

test.each(["[]", "{}", '["", 1]', "invalid"])("rejects invalid config file values: %s", (value) => {
  expect(() => getRadioConfigFiles({ RADIO_CONFIG_FILES: value }, ".env")).toThrow();
});
