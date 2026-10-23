import { writeFile } from "node:fs/promises";
import { errorDetails, rememberSecrets } from "./logging/error-details.mjs";
import { logger } from "./logger.mjs";
import { getRuntimePaths } from "./runtime-paths.mjs";
import { createAirbandSupervisor } from "./airband-supervisor.mjs";
import { createAudioInput } from "./audio/input.mjs";
import { loadRnnoise } from "./audio/rnnoise.mjs";
import { createAirbandConfig } from "./airband/config.mjs";
import { loadChannelConfig } from "./channel-config.mjs";
import { createSessionSupervisor } from "./session-supervisor.mjs";
import { createZelloSession } from "./zello/session.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaults = getRuntimePaths();

export async function createRadioRuntime({
  configPaths = defaults.configPaths,
  airbandPath = defaults.airbandPath,
  loadConfig = loadChannelConfig,
  writeConfig = writeFile,
  makeSession = createZelloSession,
  makeInput = createAudioInput,
  loadNoise = loadRnnoise,
  makeSessionSupervisor = createSessionSupervisor,
  makeAirbandSupervisor = createAirbandSupervisor,
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
  const channels = configs.map((config) => ({
    config,
    name: config.CHANNEL,
    session: makeSession(config),
    status: "connecting",
    tonePlayed: false,
  }));
  const inputs = channels.map(({ session, config }) =>
    makeInput({
      port: Number(config.UDP_PORT),
      session,
      rnnoise,
      rnnoiseMix: Number(config.RNNOISE) / 100,
      onError: reportError,
    }),
  );
  const listening = await Promise.allSettled(inputs.map((input) => input.listen()));
  const listenFailure = listening.find(({ status }) => status === "rejected");
  if (listenFailure) {
    await Promise.allSettled(inputs.map((input) => input.close()));
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
      ...(sessions ? [sessions.close()] : []),
    ]);
    throw error;
  }
  return {
    close: async () => {
      const stopAirband = airband.close();
      await Promise.all(inputs.map((input) => input.close()));
      await sessions.close();
      await stopAirband;
    },
    ready: () => airband.ready() && sessions.ready(),
    status: () => ({ receiver: airband.status(), channels: sessions.status() }),
  };
}
