import { errorDetails } from "./error-details.mjs";

export function redactError(error) {
  const details = errorDetails(error);
  const safeError = new Error(details.message);
  safeError.name = details.name;
  safeError.stack = details.stack;
  return safeError;
}

export function releaseSecretsAndRedact(releaseSecrets, error) {
  const safeError = redactError(error);
  releaseSecrets();
  return safeError;
}
