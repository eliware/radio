import { validateRequiredChannelCredentials } from "./required.mjs";

export function validateChannelCredentials(values) {
  validateRequiredChannelCredentials(values);
  if (!values.PRIVATE_KEY.includes("BEGIN PRIVATE KEY")) throw new Error("PRIVATE_KEY must be PEM");
  if (values.TOKEN) throw new Error("Remove TOKEN; use issuer and private key for production auth");
}
