import { path } from "@eliware/common";
import { tmpdir } from "node:os";

export function getRuntimePaths(env = process.env, temporaryDirectory = tmpdir()) {
  const configPaths = env.RADIO_CONFIG_FILES
    ? JSON.parse(env.RADIO_CONFIG_FILES)
    : [path(import.meta, "..", ".env")];
  if (
    !Array.isArray(configPaths) ||
    configPaths.length === 0 ||
    configPaths.some((item) => typeof item !== "string" || !item)
  )
    throw new Error("RADIO_CONFIG_FILES must be a non-empty JSON array of file paths");
  return { configPaths, airbandPath: path(temporaryDirectory, "rtl_airband.conf") };
}
