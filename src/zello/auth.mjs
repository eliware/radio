import { sign } from "node:crypto";

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function createAuthToken({ issuer, privateKey }, now = Date.now()) {
  if (!issuer || !privateKey?.includes("PRIVATE KEY"))
    throw new Error("Zello signing credentials missing");
  const header = encode({ alg: "RS256", typ: "JWT" });
  const payload = encode({ iss: issuer, exp: Math.floor(now / 1000) + 3600 });
  const content = `${header}.${payload}`;
  return `${content}.${sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url")}`;
}
