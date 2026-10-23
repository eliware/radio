import { logger as defaultLogger } from "./logger.mjs";
import { sendStartupTone } from "./startup-tone.mjs";

export function createSessionSupervisor(
  channels,
  { wait, onError, log = defaultLogger, playTone = sendStartupTone },
) {
  let stopped = false;
  let resolveStop;
  const stopSignal = new Promise((resolve) => {
    resolveStop = resolve;
  });
  const pause = (ms) => Promise.race([wait(ms), stopSignal]);
  const initial = channels.map(
    (channel) =>
      new Promise((resolve, reject) => {
        channel.resolveTone = resolve;
        channel.rejectTone = reject;
      }),
  );
  const initialReady = Promise.all(initial);
  initialReady.catch(() => {});
  let startupComplete = false;
  initialReady.then(
    () => {
      startupComplete = true;
    },
    () => {},
  );

  async function maintain(channel) {
    let delay = 1000;
    while (!stopped) {
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
        await channel.session.waitForClose();
        channel.status = "disconnected";
        log.warn("Zello channel disconnected", { channel: channel.name });
        if (Date.now() - connectedAt >= 30000) delay = 1000;
      } catch (error) {
        channel.status = "offline";
        onError(new Error(`Zello channel ${channel.name}: ${error.message}`, { cause: error }));
      }
      const retryDelay = delay;
      delay = Math.min(delay * 2, 300000);
      if (!stopped) await pause(retryDelay);
    }
  }

  const tasks = channels.map(maintain);
  return {
    initialReady,
    tasks,
    close: async () => {
      stopped = true;
      resolveStop();
      const closing = await Promise.allSettled(
        channels.map(async (channel) => {
          if (!channel.tonePlayed)
            channel.rejectTone(
              new Error("Session supervisor stopped before startup tone completed"),
            );
          await channel.session.close();
        }),
      );
      await Promise.all(tasks);
      const failure = closing.find(({ status }) => status === "rejected");
      if (failure) throw failure.reason;
    },
    status: () =>
      Object.fromEntries(
        channels.map(({ name, session, status }) => [
          name,
          {
            state: session.healthy() ? "online" : status,
          },
        ]),
      ),
    ready: () => startupComplete && channels.every(({ session }) => session.healthy()),
  };
}
