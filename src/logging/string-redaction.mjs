import redactErrorText from "./redact-error-text.mjs";

export default function redactStrings(value, secrets) {
  if (typeof value === "string") return redactErrorText(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactStrings(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactStrings(item, secrets)]),
    );
  }
  return value;
}
