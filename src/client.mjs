export async function loadReadiness(fetcher, documentObject) {
  const statusElement = documentObject.querySelector("#server-status");
  if (!statusElement) return;

  try {
    const response = await fetcher("/ready");
    statusElement.textContent = response.ok ? "Ready" : "Unavailable";
  } catch {
    statusElement.textContent = "Unavailable";
  }
}

export async function loadChannelStatus(fetcher, documentObject) {
  const channels = ["police", "fire"];
  const statusElements = Object.fromEntries(
    channels.map((channel) => [channel, documentObject.querySelector(`#${channel}-status`)]),
  );
  if (channels.every((channel) => !statusElements[channel])) return;
  let states;
  try {
    const response = await fetcher("/channels");
    if (!response.ok) throw new Error("unavailable");
    states = await response.json();
  } catch {
    states = {};
  }
  for (const channel of channels) {
    const element = statusElements[channel];
    if (!element) continue;
    const state = states[channel]?.state;
    element.textContent =
      {
        running: "Receiver ready. Select play to listen.",
        starting: "Starting receiver…",
        waiting: "Waiting for assigned SDR…",
        disconnected: "SDR disconnected. Reconnect it to recover this channel.",
        error: `Receiver error: ${states[channel]?.message ?? "check service logs"}`,
      }[state] ?? "Receiver status unavailable.";
    element.dataset.receiverState = state ?? "unavailable";
  }
}

export function bindAudioStatus(documentObject) {
  for (const channel of ["police", "fire"]) {
    const audio = documentObject.querySelector(`#${channel}-audio`);
    const status = documentObject.querySelector(`#${channel}-status`);
    if (!audio || !status) continue;
    audio.addEventListener("playing", () => {
      status.textContent = "Playing live audio.";
    });
    audio.addEventListener("waiting", () => {
      status.textContent = "Connecting to live audio…";
    });
    audio.addEventListener("error", () => {
      status.textContent = "Audio stream unavailable. Check receiver and Icecast status.";
    });
  }
}

globalThis.radioLoadReadiness = loadReadiness;
globalThis.radioLoadChannelStatus = loadChannelStatus;
globalThis.radioBindAudioStatus = bindAudioStatus;
