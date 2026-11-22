import { expect, test } from "@jest/globals";
import readStatusPort from "../../src/status/read-port.mjs";

test("accepts a valid status port", () => {
  expect(readStatusPort("1400")).toBe(1400);
});
