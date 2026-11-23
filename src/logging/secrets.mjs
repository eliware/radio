import createSecretRegistry from "./registry.mjs";

export const knownSecrets = [];
const registerSecrets = createSecretRegistry(knownSecrets);

export default function rememberSecrets(configs) {
  const secrets = configs
    .flatMap((config) => [
      config.PASSWORD,
      config.PRIVATE_KEY,
      config.TOKEN,
      config.BROADCASTIFY_PASSWORD,
    ])
    .filter(Boolean);
  return registerSecrets(secrets);
}
