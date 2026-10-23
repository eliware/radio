import { writeFile } from "node:fs/promises";
import { errorDetails, logger, rememberSecrets } from "./logger.mjs";
import { getRuntimePaths } from "./runtime-paths.mjs";
import { createAirbandSupervisor } from "./airband-supervisor.mjs";
import { createAudioInput } from "./audio/input.mjs";
import { loadRnnoise } from "./audio/rnnoise.mjs";
import { createAirbandConfig, loadChannelConfig } from "./channel-config.mjs";
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
  playTone,
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
  const inputs = channels.map(({ session }, index) =>
    makeInput({ port: 12001 + index, session, rnnoise, onError: reportError }),
  );
  await Promise.all(inputs.map((input) => input.listen()));
  log.info("Radio audio inputs are listening", { channels: configs.map(({ CHANNEL }) => CHANNEL) });
  const sessions = makeSessionSupervisor(channels, { wait, playTone, onError: reportError, log });
  const airband = makeAirbandSupervisor({
    configs,
    configPath: airbandPath,
    initialReady: sessions.initialReady,
    wait,
    onError: reportError,
    log,
    ...(present && { present }),
    ...(spawnProcess && { spawnProcess }),
  });
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
