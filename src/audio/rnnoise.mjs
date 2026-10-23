import { Rnnoise } from "@shiguredo/rnnoise-wasm";

export async function loadRnnoise(load = () => Rnnoise.load()) {
  const addWindow = globalThis.window === undefined;
  if (addWindow) globalThis.window = globalThis;
  try {
    return await load();
  } finally {
    if (addWindow) delete globalThis.window;
  }
}
