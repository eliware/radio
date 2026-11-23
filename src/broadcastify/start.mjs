import createFfmpegArgs from "./ffmpeg-args.mjs";

export default function startBroadcastifyProcess(settings, spawnProcess) {
  return spawnProcess("ffmpeg", createFfmpegArgs(settings), {
    stdio: ["pipe", "ignore", "pipe"],
  });
}
