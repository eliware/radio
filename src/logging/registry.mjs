export default function createSecretRegistry(knownSecrets) {
  const references = new Map();
  return function registerSecrets(secrets) {
    for (const secret of secrets) {
      const count = references.get(secret) ?? 0;
      references.set(secret, count + 1);
      if (count === 0) knownSecrets.push(secret);
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      for (const secret of secrets) {
        const count = references.get(secret);
        if (count === 1) {
          references.delete(secret);
          knownSecrets.splice(knownSecrets.indexOf(secret), 1);
        } else {
          references.set(secret, count - 1);
        }
      }
    };
  };
}
