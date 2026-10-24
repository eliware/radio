import { redactText } from "@eliware/common";

export const knownSecrets = [];

export function rememberSecrets(configs) {
  knownSecrets.push(
    ...configs
      .flatMap((config) => [
        config.PASSWORD,
        config.PRIVATE_KEY,
        config.TOKEN,
        config.BROADCASTIFY_PASSWORD,
      ])
      .filter(Boolean),
  );
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
