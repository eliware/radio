import getBroadcastifySettings from "../../broadcastify/settings.mjs";
import validateChannelSettings from "./validator.mjs";

export default function validateChannelBroadcastifySettings(values) {
  validateChannelSettings(values);
  getBroadcastifySettings(values);
  return values;
}
