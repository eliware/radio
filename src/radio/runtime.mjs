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

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaults = getRuntimePaths();

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
  rememberSecrets(configs);
  const rnnoise = await loadNoise();
  const reportError =
    onError ?? ((error) => log.error("Radio component failure", { error: errorDetails(error) }));
  await writeConfig(airbandPath, createAirbandConfig(configs), { mode: 0o600 });
  await chmodConfig(airbandPath, 0o600);
  const broadcastify = createBroadcastifyRuntime(configs, makeBroadcastify, reportError);
  const broadcasts = broadcastify.outputs;
  const channels = createRadioChannels(configs, makeSession);
  const inputs = createRadioInputs(channels, broadcasts, rnnoise, makeInput, reportError);
  const listening = await Promise.allSettled(inputs.map((input) => input.listen()));
  const listenFailure = listening.find(({ status }) => status === "rejected");
  if (listenFailure) {
    await Promise.allSettled([...inputs.map((input) => input.close()), broadcastify.close()]);
    throw listenFailure.reason;
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
    await Promise.allSettled([
      ...inputs.map((input) => input.close()),
      broadcastify.close(),
      ...(sessions ? [sessions.close()] : []),
    ]);
    throw error;
  }
  return {
    close: async () => {
      const closing = await Promise.allSettled([
        ...inputs.map((input) => Promise.resolve().then(() => input.close())),
        Promise.resolve().then(() => broadcastify.close()),
        Promise.resolve().then(() => sessions.close()),
        Promise.resolve().then(() => airband.close()),
      ]);
      const failure = closing.find(({ status }) => status === "rejected");
      if (failure) throw failure.reason;
    },
    ready: () => airband.ready() && sessions.ready() && broadcastify.ready(),
    status: () => ({
      receiver: airband.status(),
      channels: sessions.status(),
      broadcastify: broadcastify.status(channels),
    }),
  };
}
