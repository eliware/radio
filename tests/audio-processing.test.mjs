import { expect, test } from "@jest/globals";
import { createAudioProcessorArgs } from "../src/audio-processing.mjs";

test("isolates speech, levels transmissions, and gates quiet noise before publishing", () => {
  const args = createAudioProcessorArgs("police", 12000, "private_password_012345");
  expect(args).toContain("udp://127.0.0.1:12000?fifo_size=1000000&overrun_nonfatal=1");
  expect(args).toContain(
    "aresample=48000,arnndn=m=/usr/share/ffmpeg/arnndn/std.rnnn:mix=1,aresample=16000,dynaudnorm=f=150:g=7:p=0.9:m=10,agate=threshold=0.012:ratio=6:range=0.003:attack=10:release=300",
  );
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
