function required(values, name) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function validateAudioSettings(values) {
  const tone = Number(required(values, "TONE"));
  if (!Number.isFinite(tone) || tone < 200 || tone > 3000) throw new Error("TONE is invalid");
  const rnnoise = Number(values.RNNOISE ?? 100);
  if (!Number.isInteger(rnnoise) || rnnoise < 0 || rnnoise > 100)
    throw new Error("RNNOISE must be an integer from 0 to 100");
  values.RNNOISE = String(rnnoise);
  return values;
}
