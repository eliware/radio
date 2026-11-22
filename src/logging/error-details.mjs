import { redactText } from "@eliware/common";
import { knownSecrets } from "./secrets.mjs";

export default function errorDetails(error) {
  const value = error instanceof Error ? error : new Error(String(error));
  return {
    name: value.name,
    message: redactText(value.message, { secrets: knownSecrets }),
    ...(value.stack && { stack: redactText(value.stack, { secrets: knownSecrets }) }),
  };
}
