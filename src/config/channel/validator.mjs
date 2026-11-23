import validateChannelCredentials from "./credentials.mjs";
import validateChannelFields from "./fields.mjs";
import validateSdrSettings from "./sdr.mjs";

export default function validateChannelSettings(values) {
  validateChannelFields(values);
  validateChannelCredentials(values);
  validateSdrSettings(values);
  return values;
}
