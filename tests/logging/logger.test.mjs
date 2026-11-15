import { expect, test } from "@jest/globals";
import { createRadioLogger } from "../../src/logging/logger.mjs";

test("uses the configured default logger level for ordinary log calls", () => {
  const records = [];
  const createLoggerImpl = (options) => {
    records.push(options);
    return Object.fromEntries(["debug", "info", "warn", "error"].map((level) => [level, () => {}]));
  };
  createRadioLogger({ createLoggerImpl }).info("ready");
  expect(records[0].level).toBe("info");
});

test("constructs the default production logger", () => {
  expect(createRadioLogger()).toEqual(
    expect.objectContaining({ debug: expect.any(Function), info: expect.any(Function) }),
  );
});
