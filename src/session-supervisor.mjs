import { logger as defaultLogger } from "./logger.mjs";
import sendStartupTone from "./startup-tone.mjs";
import maintainSessionChannel from "./session/channel.mjs";

export default function createSessionSupervisor(
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

  const tasks = channels.map((channel) =>
    maintainSessionChannel(channel, {
      isStopped: () => stopped,
      pause,
      log,
      onError,
      playTone,
      wait,
    }),
  );
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
            state: stopped ? "disconnected" : session.healthy() ? "online" : status,
          },
        ]),
      ),
    ready: () => startupComplete && channels.every(({ session }) => session.healthy()),
  };
}
