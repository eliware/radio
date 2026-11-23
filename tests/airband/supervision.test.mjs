import { expect, jest, test } from "@jest/globals";
import createAirbandProcessSupervision from "../../src/airband/supervision.mjs";

const quietLog = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

test("reports process state and retries after Airband exits", async () => {
  let finishProcess;
  let releaseRetry;
  const delays = [];
  const errors = [];
  const supervision = createAirbandProcessSupervision({
    configs: [{ SDR_SERIAL: "851" }],
    wait: (ms) => {
      delays.push(ms);
      return new Promise((resolve) => (releaseRetry = resolve));
    },
    onError: (error) => errors.push(error.message),
    log: quietLog,
    present: async () => true,
    waitForDevices: async () => true,
    startProcess: ({ onStarted }) => {
      onStarted();
      return {
        finished: new Promise((resolve) => (finishProcess = resolve)),
        stop: jest.fn(),
      };
    },
  });
  for (let attempt = 0; attempt < 20 && !finishProcess; attempt += 1) await Promise.resolve();
  expect(supervision.ready()).toBe(true);
  finishProcess({ code: 1, signal: null });
  for (let attempt = 0; attempt < 20 && !releaseRetry; attempt += 1) await Promise.resolve();
  expect(supervision.status()).toMatchObject({
    state: "waiting-for-sdrs",
    error: "RTLSDR-Airband exited (1)",
  });
  expect(errors).toEqual(["RTLSDR-Airband exited (1)"]);
  expect(delays).toEqual([1000]);
  releaseRetry();
  await supervision.close();
  expect(supervision.ready()).toBe(false);
  expect(supervision.status().state).toBe("stopped");
});
