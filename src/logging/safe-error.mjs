import errorDetails from "./error-details.mjs";

export default function redactError(error) {
  const details = errorDetails(error);
  const safeError = new Error(details.message);
  safeError.name = details.name;
  safeError.stack = details.stack;
  return safeError;
}
