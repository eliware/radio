import { expect, test } from "@jest/globals";
import { sanitizeMetadata } from "../../src/logging/metadata.mjs";

test("serializes metadata and redacts sensitive keys", () => {
  expect(
    sanitizeMetadata({ note: "ordinary", password: "private", items: [7] }, [], ["password"]),
  ).toEqual({
    note: "ordinary",
    password: "[REDACTED]",
    items: [7],
  });
});

test("preserves safe primitive metadata", () => {
  expect(sanitizeMetadata(null, [], [])).toBeNull();
  expect(sanitizeMetadata(false, [], [])).toBe(false);
  expect(sanitizeMetadata("ordinary", [], [])).toBe("ordinary");
});
