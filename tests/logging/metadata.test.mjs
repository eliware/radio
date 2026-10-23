import { expect, test } from "@jest/globals";
import { sanitizeMetadata } from "../../src/logging/metadata.mjs";

test("redacts nested strings and sensitive metadata keys", () => {
  expect(
    sanitizeMetadata(
      { note: "known-secret", password: "private", items: ["known-secret", 7] },
      ["known-secret"],
      ["password"],
    ),
  ).toEqual({
    note: "[REDACTED]",
    password: "[REDACTED]",
    items: ["[REDACTED]", 7],
  });
});

test("preserves safe primitive metadata", () => {
  expect(sanitizeMetadata(null, [], [])).toBeNull();
  expect(sanitizeMetadata(false, [], [])).toBe(false);
  expect(sanitizeMetadata("ordinary", [], [])).toBe("ordinary");
});

test("uses the shared error text redactor for nested values", () => {
  expect(sanitizeMetadata({ nested: { message: "shared-secret" } }, ["shared-secret"], [])).toEqual(
    { nested: { message: "[REDACTED]" } },
  );
});
