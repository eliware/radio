import { expect, test } from "@jest/globals";
import { sanitizeBroadcastifyStderr } from "../../src/broadcastify/stderr-sanitizer.mjs";

test("redacts source credentials, mount paths, and Icecast URLs", () => {
  const detail = sanitizeBroadcastifyStderr(
    "Connection to icecast://source:secret@host.example/feed failed at /feed",
    { password: "secret", mount: "/feed" },
  );
  expect(detail).toBe("Connection to icecast://[redacted] failed at /[redacted]");
});

test("keeps only recent stderr lines and sanitizes Icecast URLs without credentials", () => {
  const stderr = Array.from({ length: 14 }, (_, index) => `line ${index + 1}`).join("\n");
  const detail = sanitizeBroadcastifyStderr(
    `${stderr}\nConnection to icecast://host.example/feed failed`,
    {},
  );
  expect(detail.split(" | ")).toHaveLength(12);
  expect(detail).not.toContain("line 1 |");
  expect(detail).toContain("line 4");
  expect(detail).toContain("icecast://[redacted]");
});

test("returns an empty detail for blank stderr", () => {
  expect(sanitizeBroadcastifyStderr("  \n ", {})).toBe("");
});
