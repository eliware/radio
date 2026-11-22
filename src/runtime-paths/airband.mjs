import { path } from "@eliware/common";

export default function getAirbandConfigPath(temporaryDirectory) {
  return path(temporaryDirectory, "rtl_airband.conf");
}
