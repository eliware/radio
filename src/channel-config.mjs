import { readChannelConfigFile } from "./config/file-reader.mjs";
import { validateAudioSettings } from "./config/audio-validator.mjs";
import { validateChannelBroadcastifySettings } from "./config/channel/broadcastify.mjs";

export async function loadChannelConfig(path, read) {
  const values = await readChannelConfigFile(path, read);
  validateChannelBroadcastifySettings(values);
  return validateAudioSettings(values);
}
