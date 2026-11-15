import { expect, test } from "@jest/globals";
import { path } from "@eliware/common";
import { getRuntimePaths } from "../src/runtime-paths.mjs";

test("defaults config files relative to this ESM module", () => {
  const { configPaths, airbandPath } = getRuntimePaths({}, "/tmp");
  expect(configPaths).toEqual([path(import.meta, "..", ".env")]);
  expect(airbandPath).toBe(path("/tmp", "rtl_airband.conf"));
});

test("uses the platform temporary directory when one is not supplied", () => {
  const { airbandPath } = getRuntimePaths({ RADIO_CONFIG_FILES: '["/run/radio/a.env"]' });
  expect(airbandPath.endsWith("rtl_airband.conf")).toBe(true);
});
