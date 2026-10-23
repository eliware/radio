import { readChannelConfigFile } from "./config/file-reader.mjs";
import { validateChannelConfig } from "./config/validator.mjs";

export async function loadChannelConfig(path, read) {
  return validateChannelConfig(await readChannelConfigFile(path, read));
}
