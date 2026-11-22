import errorDetails from "../logging/error-details.mjs";
import releaseSecretsAndRedact from "../logging/release-secrets-and-redact.mjs";
import rememberSecrets from "../logging/secrets.mjs";
import createAirbandConfig from "../airband/config.mjs";
import validateAirbandChannels from "../airband/validate-channels.mjs";

export default async function prepareRadioConfiguration({
  configPaths,
  airbandPath,
  loadConfig,
  loadNoise,
  writeConfig,
  chmodConfig,
  onError,
  log,
}) {
  if (configPaths.length === 0)
    throw new Error("At least one channel configuration file is required");
  const configs = await Promise.all(configPaths.map((configPath) => loadConfig(configPath)));
  validateAirbandChannels(configs);
  const releaseSecrets = rememberSecrets(configs);
  let rnnoise;
  let reportError;
  try {
    rnnoise = await loadNoise();
    reportError =
      onError ?? ((error) => log.error("Radio component failure", { error: errorDetails(error) }));
    await writeConfig(airbandPath, createAirbandConfig(configs), { mode: 0o600 });
    await chmodConfig(airbandPath, 0o600);
  } catch (error) {
    throw releaseSecretsAndRedact(releaseSecrets, error);
  }
  return { configs, rnnoise, releaseSecrets, reportError };
}
