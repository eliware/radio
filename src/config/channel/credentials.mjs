const requiredFields = ["CHANNEL", "USERNAME", "PASSWORD", "ISSUER", "PRIVATE_KEY"];

function required(values, name) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function validateChannelCredentials(values) {
  for (const name of requiredFields) required(values, name);
  if (!values.PRIVATE_KEY.includes("BEGIN PRIVATE KEY")) throw new Error("PRIVATE_KEY must be PEM");
  if (values.TOKEN) throw new Error("Remove TOKEN; use issuer and private key for production auth");
}
