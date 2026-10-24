import { expect, test } from "@jest/globals";
import { getBroadcastifySettings } from "../../src/broadcastify/settings.mjs";

const valid = {
  BROADCASTIFY_ENABLED: "true",
  BROADCASTIFY_HOST: "ice.example.org",
  BROADCASTIFY_PORT: "8000",
  BROADCASTIFY_MOUNT: "/radio/pd",
  BROADCASTIFY_PASSWORD: " secret ",
  CHANNEL: "Police",
};

test("keeps disabled output off and defaults an absent flag to false", () => {
  expect(getBroadcastifySettings({})).toEqual({ enabled: false });
  expect(getBroadcastifySettings({ BROADCASTIFY_ENABLED: "false" })).toEqual({ enabled: false });
});

test("validates enabled connection values and defaults the stream name", () => {
  expect(getBroadcastifySettings(valid)).toEqual({
    enabled: true,
    host: "ice.example.org",
    port: 8000,
    mount: "/radio/pd",
    password: "secret",
    name: "Police",
  });
  expect(getBroadcastifySettings({ ...valid, BROADCASTIFY_NAME: " Fire " }).name).toBe("Fire");
  expect(getBroadcastifySettings({ ...valid, BROADCASTIFY_NAME: " " }).name).toBe("Police");
});

test("rejects invalid flags and missing or malformed enabled values", () => {
  expect(() => getBroadcastifySettings({ BROADCASTIFY_ENABLED: "yes" })).toThrow(
    "must be true or false",
  );
  for (const key of [
    "BROADCASTIFY_HOST",
    "BROADCASTIFY_PORT",
    "BROADCASTIFY_MOUNT",
    "BROADCASTIFY_PASSWORD",
  ])
    expect(() => getBroadcastifySettings({ ...valid, [key]: " " })).toThrow(`${key} must be set`);
  expect(() => getBroadcastifySettings({ ...valid, BROADCASTIFY_HOST: "bad host" })).toThrow(
    "HOST is invalid",
  );
  for (const port of ["0", "65536", "1.5"])
    expect(() => getBroadcastifySettings({ ...valid, BROADCASTIFY_PORT: port })).toThrow(
      "PORT must be an integer",
    );
  for (const mount of ["radio", "/bad mount"])
    expect(() => getBroadcastifySettings({ ...valid, BROADCASTIFY_MOUNT: mount })).toThrow(
      "MOUNT is invalid",
    );
});
