import { path } from "@eliware/common";
import { tmpdir } from "node:os";
import { getRadioConfigFiles } from "./runtime-paths/config-files.mjs";

export function getRuntimePaths(env = process.env, temporaryDirectory = tmpdir()) {
  const configPaths = getRadioConfigFiles(env, path(import.meta, "..", ".env"));
  return { configPaths, airbandPath: path(temporaryDirectory, "rtl_airband.conf") };
}
