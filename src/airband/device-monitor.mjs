export async function waitForAirbandDevices(
  configs,
  { present, wait, shouldStop = () => false, onMissing = () => {} },
) {
  const serials = [...new Set(configs.map(({ SDR_SERIAL }) => SDR_SERIAL))];
  while (!shouldStop()) {
    const detected = await Promise.all(serials.map((serial) => present(serial)));
    if (shouldStop()) return false;
    if (detected.every(Boolean)) return true;
    onMissing();
    await wait(2000);
  }
  return false;
}
