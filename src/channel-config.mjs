import { readChannelConfigFile } from "./config/file-reader.mjs";
import { validateAudioSettings } from "./config/audio-validator.mjs";
import { validateChannelSettings } from "./config/channel-validator.mjs";

export async function loadChannelConfig(path, read) {
  const values = await readChannelConfigFile(path, read);
  validateChannelSettings(values);
  return validateAudioSettings(values);
}
