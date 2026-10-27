import { getBroadcastifySettings } from "./settings.mjs";
import { createBroadcastifyStream } from "./stream.mjs";
import { createBroadcastifySupervisor } from "./supervisor.mjs";

export function createBroadcastifyRuntime(
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
          write: stream.write,
          ready: supervisor.ready,
          status: supervisor.status,
          close: async () => {
            try {
              stream.close();
            } finally {
              await supervisor.close();
            }
          },
        });
      } catch (error) {
        Promise.resolve(supervisor.close()).catch(onError);
        throw error;
      }
    }
  } catch (error) {
    outputs.forEach((output) => Promise.resolve(output.close()).catch(onError));
    throw error;
  }
  return {
    outputs,
    ready: () => outputs.every((output) => output.ready()),
    status: (channels) =>
      Object.fromEntries(channels.map(({ name }, index) => [name, outputs[index].status()])),
    close: () => Promise.allSettled(outputs.map((output) => output.close())),
  };
}
