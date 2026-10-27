import { getBroadcastifySettings } from "./settings.mjs";
import { createBroadcastifyStream } from "./stream.mjs";
import { createBroadcastifySupervisor } from "./supervisor.mjs";

export async function createBroadcastifyRuntime(
  configs,
  createStream = createBroadcastifyStream,
  onError = () => {},
  createSupervisor = createBroadcastifySupervisor,
) {
  const outputs = [];
  try {
    for (const config of configs) {
      const settings = getBroadcastifySettings(config);
      const supervisor = createSupervisor(settings, { onError });
      try {
        const stream = createStream(settings, {
          onError,
          getChild: () => supervisor.child,
        });
        outputs.push({
          channel: config.CHANNEL,
          write: stream.write,
          ready: supervisor.ready,
          status: supervisor.status,
          close: async () => {
            try {
              await stream.close();
            } finally {
              await supervisor.close();
            }
          },
        });
      } catch (error) {
        await Promise.resolve(supervisor.close()).catch(onError);
        throw error;
      }
    }
  } catch (error) {
    await Promise.allSettled(outputs.map((output) => output.close()));
    throw error;
  }
  return {
    outputs,
    ready: () => outputs.every((output) => output.ready()),
    status: (channels) => {
      const outputByChannel = new Map(outputs.map((output) => [output.channel, output]));
      return Object.fromEntries(
        channels.map(({ name }) => [
          name,
          outputByChannel.get(name)?.status() ?? { state: "disabled" },
        ]),
      );
    },
    close: () => Promise.allSettled(outputs.map((output) => output.close())),
  };
}
