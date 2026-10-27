import { redactText } from "@eliware/common";

export const knownSecrets = [];
const secretReferences = new Map();

export function rememberSecrets(configs) {
  const secrets = configs
    .flatMap((config) => [
      config.PASSWORD,
      config.PRIVATE_KEY,
      config.TOKEN,
      config.BROADCASTIFY_PASSWORD,
    ])
    .filter(Boolean);
  for (const secret of secrets) {
    const references = secretReferences.get(secret) ?? 0;
    secretReferences.set(secret, references + 1);
    if (references === 0) knownSecrets.push(secret);
  }
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const secret of secrets) {
      const references = secretReferences.get(secret);
      if (references === 1) {
        secretReferences.delete(secret);
        knownSecrets.splice(knownSecrets.indexOf(secret), 1);
      } else {
        secretReferences.set(secret, references - 1);
      }
    }
  };
}

export function errorDetails(error) {
  const value = error instanceof Error ? error : new Error(String(error));
  return {
    name: value.name,
    message: redactText(value.message, { secrets: knownSecrets }),
    ...(value.stack && { stack: redactText(value.stack, { secrets: knownSecrets }) }),
  };
}

export function redactErrorText(text, secrets = knownSecrets) {
  return redactText(text, { secrets });
}
