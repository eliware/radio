import { expect, jest, test } from "@jest/globals";
import createZelloPendingRequests from "../../src/zello/pending-requests.mjs";

test("tracks sequence numbers and removes pending requests", () => {
  const pending = createZelloPendingRequests();
  expect(pending.nextSequence()).toBe(1);
  expect(pending.nextSequence()).toBe(2);
  pending.waiting.set(1, {});
  pending.remove(1);
  expect(pending.waiting.has(1)).toBe(false);
});

test("fails all pending requests and clears their timers", async () => {
  const pending = createZelloPendingRequests();
  const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
  const reject = jest.fn();
  const error = new Error("closed");
  pending.waiting.set(1, { reject, timer: 4 });
  pending.failAll(error);
  expect(clearTimeoutSpy).toHaveBeenCalledWith(4);
  expect(reject).toHaveBeenCalledWith(error);
  expect(pending.waiting.size).toBe(0);
  clearTimeoutSpy.mockRestore();
});
