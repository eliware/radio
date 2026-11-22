export default function createRadioChannels(configs, makeSession) {
  return configs.map((config) => ({
    config,
    name: config.CHANNEL,
    session: makeSession(config),
    status: "connecting",
    tonePlayed: false,
  }));
}
