export function createAudioProcessorArgs(channel, port, password) {
  if (!["police", "fire"].includes(channel)) throw new Error("Unknown audio channel");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid UDP port");
  if (!/^[a-zA-Z0-9_-]{16,}$/.test(password ?? "")) throw new Error("Invalid Icecast password");
  return [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-f",
    "f32le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-i",
    `udp://127.0.0.1:${port}?fifo_size=1000000&overrun_nonfatal=1`,
    "-af",
    "aresample=48000,arnndn=m=/usr/share/ffmpeg/arnndn/std.rnnn:mix=1,aresample=16000,dynaudnorm=f=150:g=7:p=0.9:m=10,agate=threshold=0.012:ratio=6:range=0.003:attack=10:release=300",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "48k",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-content_type",
    "audio/mpeg",
    "-f",
    "mp3",
    `icecast://source:${password}@icecast:8000/${channel}.mp3`,
  ];
}
