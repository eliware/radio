import { path } from "@eliware/common";
import { tmpdir } from "node:os";

export function getRuntimePaths(env = process.env, temporaryDirectory = tmpdir()) {
  const configDirectory = env.RADIO_CONFIG_DIR;
  const configPaths = configDirectory
    ? [path(configDirectory, "police.env"), path(configDirectory, "fire.env")]
    : [path(import.meta, "..", ".env.pd"), path(import.meta, "..", ".env.fd")];
  return { configPaths, airbandPath: path(temporaryDirectory, "rtl_airband.conf") };
}
