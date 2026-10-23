import { generateKeyPairSync, verify } from "node:crypto";
import { createAuthToken } from "../../src/zello/auth.mjs";

test("creates a one-hour RS256 production auth token", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const token = createAuthToken({ issuer: "issuer", privateKey: pem }, 1_000_000);
  const [header, payload, signature] = token.split(".");
  const content = `${header}.${payload}`;
  expect(JSON.parse(Buffer.from(header, "base64url"))).toEqual({ alg: "RS256", typ: "JWT" });
  expect(JSON.parse(Buffer.from(payload, "base64url"))).toEqual({ iss: "issuer", exp: 4600 });
  expect(
    verify("RSA-SHA256", Buffer.from(content), publicKey, Buffer.from(signature, "base64url")),
  ).toBe(true);
});

test("requires an issuer and private key", () => {
  expect(() => createAuthToken({ issuer: "", privateKey: "" })).toThrow();
});
