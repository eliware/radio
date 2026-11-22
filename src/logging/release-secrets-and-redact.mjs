import redactError from "./safe-error.mjs";

export default function releaseSecretsAndRedact(releaseSecrets, error) {
  const safeError = redactError(error);
  releaseSecrets();
  return safeError;
}
