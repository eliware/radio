export default function getRadioConfigFiles(env, defaultPath) {
  const configPaths = env.RADIO_CONFIG_FILES ? JSON.parse(env.RADIO_CONFIG_FILES) : [defaultPath];
  if (
    !Array.isArray(configPaths) ||
    configPaths.length === 0 ||
    configPaths.some((item) => typeof item !== "string" || !item)
  )
    throw new Error("RADIO_CONFIG_FILES must be a non-empty JSON array of file paths");
  return configPaths;
}
