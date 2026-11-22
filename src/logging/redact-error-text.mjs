import { redactText } from "@eliware/common";
import { knownSecrets } from "./secrets.mjs";

export default function redactErrorText(text, secrets = knownSecrets) {
  return redactText(text, { secrets });
}
