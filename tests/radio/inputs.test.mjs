import { expect, jest, test } from "@jest/globals";
import createRadioInputs from "../../src/radio/inputs.mjs";

test("creates an input with the channel output and noise settings", () => {
  const output = { write: jest.fn() };
  const input = createRadioInputs(
    [{ config: { UDP_PORT: "15581", RNNOISE: "80" }, session: "police" }],
    [output],
    "rnnoise",
    (options) => options,
    "onError",
  )[0];
  expect(input).toEqual({
    port: 15581,
    session: "police",
    rnnoise: "rnnoise",
    rnnoiseMix: 0.8,
    onProcessedPcm: output.write,
    onError: "onError",
  });
});
