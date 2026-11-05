import { expect, test } from "@jest/globals";
import { path } from "@eliware/common";
import { getRuntimePaths } from "../src/runtime-paths.mjs";

test("builds configured paths and a temporary config path", () => {
  expect(
    getRuntimePaths({ RADIO_CONFIG_FILES: '["/run/radio/a.env", "/run/radio/b.env"]' }, "/tmp"),
  ).toEqual({
    configPaths: ["/run/radio/a.env", "/run/radio/b.env"],
    airbandPath: path("/tmp", "rtl_airband.conf"),
  });
});

test("defaults config files relative to this ESM module", () => {
  const { configPaths, airbandPath } = getRuntimePaths({}, "/tmp");
  expect(configPaths).toEqual([path(import.meta, "..", ".env")]);
  expect(airbandPath).toBe(path("/tmp", "rtl_airband.conf"));
});

test("rejects an empty configured file list", () => {
  expect(() => getRuntimePaths({ RADIO_CONFIG_FILES: "[]" })).toThrow(
    "RADIO_CONFIG_FILES must be a non-empty JSON array of file paths",
  );
});

test("uses the platform temporary directory when one is not supplied", () => {
  const { airbandPath } = getRuntimePaths({ RADIO_CONFIG_FILES: '["/run/radio/a.env"]' });
  expect(airbandPath.endsWith("rtl_airband.conf")).toBe(true);
});
