import { afterEach, expect, jest, test } from "@jest/globals";
import { loadRnnoise } from "../../src/audio/rnnoise.mjs";

const savedWindow = globalThis.window;
afterEach(() => {
  if (savedWindow === undefined) delete globalThis.window;
  else globalThis.window = savedWindow;
});

test("temporarily adds a browser global for the Node WASM build", async () => {
  delete globalThis.window;
  const load = jest.fn(async () => {
    expect(globalThis.window).toBe(globalThis);
    return { frameSize: 480 };
  });
  await expect(loadRnnoise(load)).resolves.toEqual({ frameSize: 480 });
  expect(globalThis.window).toBeUndefined();
});

test("preserves an existing window global and restores state after load failure", async () => {
  const existingWindow = {};
  globalThis.window = existingWindow;
  await expect(
    loadRnnoise(async () => {
      expect(globalThis.window).toBe(existingWindow);
      throw new Error("load failed");
    }),
  ).rejects.toThrow("load failed");
  expect(globalThis.window).toBe(existingWindow);
});

test("loads the bundled RNNoise implementation by default", async () => {
  delete globalThis.window;
  const rnnoise = await loadRnnoise();
  expect(rnnoise.frameSize).toBeGreaterThan(0);
  expect(globalThis.window).toBeUndefined();
});
