import { getBroadcastifySettings } from "./settings.mjs";
import { createBroadcastifyStream } from "./stream.mjs";

export function createBroadcastifyRuntime(
  configs,
  createStream = createBroadcastifyStream,
  onError = () => {},
) {
  const outputs = configs.map((config) =>
    createStream(getBroadcastifySettings(config), { onError }),
  );
  return {
    outputs,
    ready: () => outputs.every((output) => output.ready()),
    status: (channels) =>
      Object.fromEntries(channels.map(({ name }, index) => [name, outputs[index].status()])),
    close: () => Promise.allSettled(outputs.map((output) => output.close())),
  };
}
