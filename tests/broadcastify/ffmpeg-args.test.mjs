import { expect, test } from "@jest/globals";
import { createFfmpegArgs } from "../../src/broadcastify/ffmpeg-args.mjs";

test("builds a paced mono MP3 Icecast command and encodes credentials", () => {
  const args = createFfmpegArgs({
    host: "ice.example.org",
    port: 8000,
    mount: "/windham",
    password: "p@ss word",
    name: "PD",
  });
  expect(args).toEqual([
    "-hide_banner",
    "-loglevel",
    "info",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "1",
    "-i",
    "pipe:0",
    "-vn",
    "-ar",
    "22050",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "16k",
    "-content_type",
    "audio/mpeg",
    "-f",
    "mp3",
    "-ice_name",
    "PD",
    "-legacy_icecast",
    "1",
    "icecast://source:p%40ss%20word@ice.example.org:8000/windham",
  ]);
});
