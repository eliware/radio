import createToneFrame from "./frame.mjs";

export default function* createStartupToneFrames(frequency, frameCount = 50) {
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1)
    yield createToneFrame(frequency, frameIndex);
}
