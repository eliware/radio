import { chmod, writeFile } from "node:fs/promises";
import { errorDetails, rememberSecrets } from "../logging/error-details.mjs";
import { logger } from "../logger.mjs";
import { getRuntimePaths } from "../runtime-paths.mjs";
import { createAirbandSupervisor } from "../airband-supervisor.mjs";
import { createAudioInput } from "../audio/input.mjs";
import { loadRnnoise } from "../audio/rnnoise.mjs";
import { createAirbandConfig } from "../airband/config.mjs";
import { loadChannelConfig } from "../channel-config.mjs";
import { createSessionSupervisor } from "../session-supervisor.mjs";
import { createZelloSession } from "../zello/session.mjs";
import { createBroadcastifyStream } from "../broadcastify/stream.mjs";
import { createBroadcastifyRuntime } from "../broadcastify/runtime.mjs";
import { createRadioChannels, createRadioInputs } from "./channels.mjs";
import { closeRadioResources } from "./resources.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaults = getRuntimePaths();

function releaseSecretsAndRedact(releaseSecrets, error) {
  const details = errorDetails(error);
  releaseSecrets();
  const safeError = new Error(details.message);
  safeError.name = details.name;
  safeError.stack = details.stack;
  return safeError;
}

export async function createRadioRuntime({
  configPaths = defaults.configPaths,
  airbandPath = defaults.airbandPath,
  loadConfig = loadChannelConfig,
  writeConfig = writeFile,
  chmodConfig = chmod,
  makeSession = createZelloSession,
  makeInput = createAudioInput,
  loadNoise = loadRnnoise,
  makeSessionSupervisor = createSessionSupervisor,
  makeAirbandSupervisor = createAirbandSupervisor,
  makeBroadcastify = createBroadcastifyStream,
  present,
  spawnProcess,
  wait = pause,
  onError,
  log = logger,
}) {
  const configs = await Promise.all(configPaths.map((configPath) => loadConfig(configPath)));
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
  let broadcastify;
  let inputs = [];
  let channels;
  try {
    broadcastify = createBroadcastifyRuntime(configs, makeBroadcastify, reportError);
    channels = createRadioChannels(configs, makeSession);
    inputs = createRadioInputs(channels, broadcastify.outputs, rnnoise, makeInput, reportError);
  } catch (error) {
    await closeRadioResources({ inputs, broadcastify }, { ignoreErrors: true });
    throw releaseSecretsAndRedact(releaseSecrets, error);
  }
  const listening = await Promise.allSettled(
    inputs.map((input) => Promise.resolve().then(() => input.listen())),
  );
  const listenFailure = listening.find(({ status }) => status === "rejected");
  if (listenFailure) {
    await closeRadioResources({ inputs, broadcastify }, { ignoreErrors: true });
    throw releaseSecretsAndRedact(releaseSecrets, listenFailure.reason);
  }
  log.info("Radio audio inputs are listening", { channels: configs.map(({ CHANNEL }) => CHANNEL) });
  let sessions;
  let airband;
  try {
    sessions = makeSessionSupervisor(channels, { wait, onError: reportError, log });
    airband = makeAirbandSupervisor({
      configs,
      configPath: airbandPath,
      wait,
      onError: reportError,
      log,
      ...(present && { present }),
      ...(spawnProcess && { spawnProcess }),
    });
  } catch (error) {
    await closeRadioResources({ inputs, broadcastify, sessions }, { ignoreErrors: true });
    throw releaseSecretsAndRedact(releaseSecrets, error);
  }
  return {
    close: async () => {
      try {
        await closeRadioResources({ inputs, broadcastify, sessions, airband });
      } finally {
        releaseSecrets();
      }
    },
    ready: () => airband.ready() && sessions.ready() && broadcastify.ready(),
    status: () => ({
      receiver: airband.status(),
      channels: sessions.status(),
      broadcastify: broadcastify.status(channels),
    }),
  };
}
