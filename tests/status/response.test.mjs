import { expect, test } from "@jest/globals";
import { createStatusResponse } from "../../src/status/response.mjs";

test("formats healthy status responses as JSON", () => {
  const status = { receiver: { state: "running" } };
  expect(createStatusResponse("/health", false, status)).toEqual({
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "ok", ...status }),
  });
  expect(createStatusResponse("/ready", true, status)).toMatchObject({
    statusCode: 200,
    body: JSON.stringify({ status: "ready", ...status }),
  });
});

test("marks an unready response unavailable", () => {
  expect(createStatusResponse("/ready", false, {})).toMatchObject({
    statusCode: 503,
    body: '{"status":"not-ready"}',
  });
});
