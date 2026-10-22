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

globalThis.radioLoadReadiness = loadReadiness;
