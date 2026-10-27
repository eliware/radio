import { getBroadcastifySettings } from "./settings.mjs";
import { createBroadcastifyStream } from "./stream.mjs";

export function createBroadcastifyRuntime(
  configs,
  createStream = createBroadcastifyStream,
  onError = () => {},
) {
  const outputs = [];
  try {
    for (const config of configs)
      outputs.push(createStream(getBroadcastifySettings(config), { onError }));
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
