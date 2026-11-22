const requiredFields = ["CHANNEL", "USERNAME", "PASSWORD", "ISSUER", "PRIVATE_KEY"];

export default function validateRequiredChannelCredentials(values) {
  for (const name of requiredFields) {
    const value = values[name]?.trim();
    if (!value) throw new Error(`${name} must be set`);
  }
}
