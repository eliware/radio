import { path } from "@eliware/common";

export function getAirbandConfigPath(temporaryDirectory) {
  return path(temporaryDirectory, "rtl_airband.conf");
}
