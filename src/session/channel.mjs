export default async function maintainSessionChannel(
  channel,
  { isStopped, pause, log, onError, playTone, wait },
) {
  let delay = 1000;
  while (!isStopped()) {
    try {
      channel.status = "connecting";
      log.debug("Connecting to Zello channel", { channel: channel.name, retryDelayMs: delay });
      await channel.session.connect();
      channel.status = "online";
      log.info("Connected to Zello channel", { channel: channel.name });
      const connectedAt = Date.now();
      if (!channel.tonePlayed) {
        await playTone(channel.session, Number(channel.config.TONE), wait);
        channel.tonePlayed = true;
        channel.resolveTone();
      }
      const disconnectError = await channel.session.waitForClose();
      channel.status = "degraded";
      log.warn("Zello channel disconnected", {
        channel: channel.name,
        ...(disconnectError && { error: disconnectError.message }),
      });
      if (Date.now() - connectedAt >= 30000) delay = 1000;
    } catch (error) {
      channel.status = "degraded";
      onError(new Error(`Zello channel ${channel.name}: ${error.message}`, { cause: error }));
    }
    const retryDelay = delay;
    delay = Math.min(delay * 2, 300000);
    if (!isStopped()) await pause(retryDelay);
  }
}
