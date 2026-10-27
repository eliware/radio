import { expect, test } from "@jest/globals";
import { createAirbandRetry } from "../../src/airband/retry.mjs";

test("doubles retry delays to the ceiling and resets after a device wait", () => {
  const retry = createAirbandRetry();
  expect([retry.nextDelay(), retry.nextDelay(), retry.nextDelay()]).toEqual([1000, 2000, 4000]);
  expect(retry.nextDelay()).toBe(8000);
  retry.reset();
  expect(retry.nextDelay()).toBe(1000);
});

test("supports a custom initial and maximum delay", () => {
  const retry = createAirbandRetry({ initialDelayMs: 10, maxDelayMs: 20 });
  expect([retry.nextDelay(), retry.nextDelay(), retry.nextDelay()]).toEqual([10, 20, 20]);
});
