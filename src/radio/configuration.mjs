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
    const recentErrors = new Map();
    reportError = (error) => {
      const message = error?.message ?? String(error);
      const now = Date.now();
      const previous = recentErrors.get(message);
      if (previous && now - previous.time < 60000) {
        previous.suppressed += 1;
        return;
      }
      const reportedError =
        previous?.suppressed > 0
          ? new Error(`Repeated error suppressed ${previous.suppressed} times: ${message}`, {
              cause: error,
            })
          : error;
      recentErrors.set(message, { time: now, suppressed: 0 });
      if (recentErrors.size > 100) recentErrors.delete(recentErrors.keys().next().value);
      if (onError) onError(reportedError);
      else log.error("Radio component failure", { error: errorDetails(reportedError) });
    };
    await writeConfig(airbandPath, createAirbandConfig(configs), { mode: 0o600 });
    await chmodConfig(airbandPath, 0o600);
  } catch (error) {
    throw releaseSecretsAndRedact(releaseSecrets, error);
  }
  return { configs, rnnoise, releaseSecrets, reportError };
}
