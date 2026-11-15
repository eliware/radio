import { defaultPolicy } from "@eliware/common";
import { redactErrorText } from "./error-details.mjs";
import { sanitizeMetadata } from "./metadata.mjs";

export const privateKeys = [
  ...defaultPolicy.keys,
  "password",
  "private_key",
  "public_key",
  "issuer",
  "auth_token",
  "api_key",
];

export function createSanitizedLogger(base, secrets) {
  const methods = ["debug", "info", "warn", "error"];
  return Object.fromEntries(
    methods.map((method) => [
      method,
      (message, metadata = {}) =>
        base[method](
          redactErrorText(message, secrets),
          sanitizeMetadata(metadata, secrets, privateKeys),
        ),
    ]),
  );
}
