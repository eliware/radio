import { expect, test } from "@jest/globals";
import { path } from "@eliware/common";
import { getRuntimePaths } from "../src/runtime-paths.mjs";

test("defaults config files relative to this ESM module", () => {
  const { configPaths } = getRuntimePaths({}, "/tmp");
  expect(configPaths).toEqual([path(import.meta, "..", ".env")]);
});

test("assembles paths for configured channel files", () => {
  const paths = getRuntimePaths({ RADIO_CONFIG_FILES: '["/run/radio/a.env"]' }, "/tmp");
  expect(paths.configPaths).toEqual(["/run/radio/a.env"]);
});
