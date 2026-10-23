import { expect, test } from "@jest/globals";
import { path } from "@eliware/common";
import { getRuntimePaths } from "../src/runtime-paths.mjs";

test("builds mounted config paths and a temporary config path with native separators", () => {
  expect(getRuntimePaths({ RADIO_CONFIG_DIR: "/run/radio" }, "/tmp")).toEqual({
    configPaths: [path("/run/radio", "police.env"), path("/run/radio", "fire.env")],
    airbandPath: path("/tmp", "rtl_airband.conf"),
  });
});

test("defaults config files relative to this ESM module", () => {
  const { configPaths, airbandPath } = getRuntimePaths({}, "/tmp");
  expect(configPaths).toEqual([
    path(import.meta, "..", ".env.pd"),
    path(import.meta, "..", ".env.fd"),
  ]);
  expect(airbandPath).toBe(path("/tmp", "rtl_airband.conf"));
});

test("uses the platform temporary directory when one is not supplied", () => {
  const { airbandPath } = getRuntimePaths({ RADIO_CONFIG_DIR: "/run/radio" });
  expect(airbandPath.endsWith("rtl_airband.conf")).toBe(true);
});
