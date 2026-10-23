import { expect, jest, test } from "@jest/globals";
import { waitForAirbandDevices } from "../../src/airband/device-monitor.mjs";

test("waits until all configured SDR serials are present", async () => {
  const calls = [];
  const ready = await waitForAirbandDevices([{ SDR_SERIAL: "851" }, { SDR_SERIAL: "853" }], {
    present: async (serial) => (calls.push(serial), true),
    wait: jest.fn(),
  });
  expect(ready).toBe(true);
  expect(calls).toEqual(["851", "853"]);
});

test("polls missing hardware every two seconds until it appears", async () => {
  let checks = 0;
  const delays = [];
  const missing = jest.fn();
  const ready = await waitForAirbandDevices([{ SDR_SERIAL: "851" }], {
    present: async () => ++checks > 1,
    wait: async (ms) => delays.push(ms),
    onMissing: missing,
  });
  expect(ready).toBe(true);
  expect(delays).toEqual([2000]);
  expect(missing).toHaveBeenCalledTimes(1);
});

test("returns without another poll after shutdown", async () => {
  let stopped = false;
  const present = jest.fn(async () => false);
  const ready = await waitForAirbandDevices([{ SDR_SERIAL: "851" }], {
    present,
    wait: async () => {
      stopped = true;
    },
    shouldStop: () => stopped,
  });
  expect(ready).toBe(false);
  expect(present).toHaveBeenCalledTimes(1);
});

test("stops after a presence check when shutdown starts", async () => {
  let stopped = false;
  const ready = await waitForAirbandDevices([{ SDR_SERIAL: "851" }], {
    present: async () => {
      stopped = true;
      return true;
    },
    wait: jest.fn(),
    shouldStop: () => stopped,
  });
  expect(ready).toBe(false);
});

test("propagates USB detection errors for supervisor retry handling", async () => {
  await expect(
    waitForAirbandDevices([{ SDR_SERIAL: "851" }], {
      present: async () => {
        throw new Error("USB scan failed");
      },
      wait: async () => {},
    }),
  ).rejects.toThrow("USB scan failed");
});
