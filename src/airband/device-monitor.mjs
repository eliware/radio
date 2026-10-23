export async function waitForAirbandDevices(
  configs,
  { present, wait, shouldStop = () => false, onMissing = () => {} },
) {
  while (!shouldStop()) {
    const detected = await Promise.all(configs.map(({ SDR_SERIAL }) => present(SDR_SERIAL)));
    if (shouldStop()) return false;
    if (detected.every(Boolean)) return true;
    onMissing();
    await wait(2000);
  }
  return false;
}
