import { expect, test } from "@jest/globals";
import { createRadioServer, parsePort } from "../src/server.mjs";

test("serves health and readiness status", async () => {
  const app = await createRadioServer();

  await expect(app.inject({ method: "GET", url: "/health" })).resolves.toMatchObject({
    statusCode: 200,
    payload: JSON.stringify({ status: "ok" }),
  });
  await expect(app.inject({ method: "GET", url: "/ready" })).resolves.toMatchObject({
    statusCode: 200,
    payload: JSON.stringify({ status: "ready" }),
  });
  await app.close();
});

test("serves the basic status page and browser bundle", async () => {
  const app = await createRadioServer();
  const page = await app.inject({ method: "GET", url: "/" });
  const bundle = await app.inject({ method: "GET", url: "/client.js" });

  expect(page.statusCode).toBe(200);
  expect(page.body).toContain("Radio service");
  expect(bundle.statusCode).toBe(200);
  await app.close();
});

test.each(["3000", 8080, "65535"])("accepts valid port %s", (value) => {
  expect(parsePort(value)).toBe(Number(value));
});

test.each(["0", "65536", "abc", "1.5"])("rejects invalid port %s", (value) => {
  expect(() => parsePort(value)).toThrow("PORT must be an integer from 1 through 65535");
});
