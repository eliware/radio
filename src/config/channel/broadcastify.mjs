import { getBroadcastifySettings } from "../../broadcastify/settings.mjs";
import { validateChannelSettings } from "./validator.mjs";

export function validateChannelBroadcastifySettings(values) {
  validateChannelSettings(values);
  getBroadcastifySettings(values);
  return values;
}
