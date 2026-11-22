import { expect, test } from "@jest/globals";
import createStartupToneFrames from "../../../src/audio/tone/startup-frames.mjs";

test("generates the requested number of startup tone frames", () => {
  expect([...createStartupToneFrames(1000, 2)]).toHaveLength(2);
});
