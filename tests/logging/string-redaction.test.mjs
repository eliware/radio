import { expect, test } from "@jest/globals";
import redactStrings from "../../src/logging/string-redaction.mjs";

test("redacts matching strings recursively in arrays and objects", () => {
  expect(
    redactStrings({ nested: { message: "shared-secret" }, items: ["shared-secret", 7] }, [
      "shared-secret",
    ]),
  ).toEqual({ nested: { message: "[REDACTED]" }, items: ["[REDACTED]", 7] });
});

test("preserves primitives and nonmatching strings", () => {
  expect(redactStrings(null, [])).toBeNull();
  expect(redactStrings(false, [])).toBe(false);
  expect(redactStrings("ordinary", [])).toBe("ordinary");
});
