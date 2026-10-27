import { expect, test } from "@jest/globals";
import { redactBroadcastifyText } from "../../src/broadcastify/redaction.mjs";

test("redacts mount paths and Icecast URLs", () => {
  expect(redactBroadcastifyText("Mount /feed failed at icecast://source@host/feed", "/feed")).toBe(
    "Mount /[redacted] failed at icecast://[redacted]",
  );
});

test("redacts Icecast URLs when no mount is configured", () => {
  expect(redactBroadcastifyText("icecast://host/feed is offline")).toBe(
    "icecast://[redacted] is offline",
  );
});

test("preserves text without sensitive values", () => {
  expect(redactBroadcastifyText("FFmpeg exited with code 1", "")).toBe("FFmpeg exited with code 1");
});
