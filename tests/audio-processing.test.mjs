import { expect, test } from "@jest/globals";
import { createAudioProcessorArgs } from "../src/audio-processing.mjs";

test("denoises and levels each channel before publishing to its Icecast mount", () => {
  const args = createAudioProcessorArgs("police", 12000, "private_password_012345");
  expect(args).toContain("udp://127.0.0.1:12000?fifo_size=1000000&overrun_nonfatal=1");
  expect(args).toContain("afftdn=nr=8:nf=-50:tn=1,dynaudnorm=f=150:g=7:p=0.9:m=10");
  expect(args).toContain("audio/mpeg");
  expect(args.at(-1)).toBe("icecast://source:private_password_012345@icecast:8000/police.mp3");
});

test.each([
  ["unknown", 12000, "private_password_012345", "Unknown audio channel"],
  ["fire", 0, "private_password_012345", "Invalid UDP port"],
  ["fire", 12000, "short", "Invalid Icecast password"],
  ["fire", 12000, undefined, "Invalid Icecast password"],
])("rejects invalid audio processing settings", (channel, port, password, message) => {
  expect(() => createAudioProcessorArgs(channel, port, password)).toThrow(message);
});
