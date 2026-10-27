import { expect, test } from "@jest/globals";
import { createRadioLogger, logger } from "../src/logger.mjs";

test("exports the default logger and its constructor", () => {
  expect(createRadioLogger).toEqual(expect.any(Function));
  expect(logger).toEqual(
    expect.objectContaining({
      debug: expect.any(Function),
      info: expect.any(Function),
      warn: expect.any(Function),
      error: expect.any(Function),
    }),
  );
});
