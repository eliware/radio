import { expect, jest, test } from "@jest/globals";
import { createRadioChannels, createRadioInputs } from "../../src/radio/channels.mjs";

test("creates one named channel with a session per config", () => {
  const configs = [{ CHANNEL: "PD" }, { CHANNEL: "FD" }];
  const makeSession = jest.fn((config) => ({ config }));
  expect(createRadioChannels(configs, makeSession)).toEqual([
    {
      config: configs[0],
      name: "PD",
      session: { config: configs[0] },
      status: "connecting",
      tonePlayed: false,
    },
    {
      config: configs[1],
      name: "FD",
      session: { config: configs[1] },
      status: "connecting",
      tonePlayed: false,
    },
  ]);
  expect(makeSession).toHaveBeenCalledTimes(2);
});

test("connects each input to its channel output and RNNoise settings", () => {
  const channels = [
    { config: { UDP_PORT: "15581", RNNOISE: "80" }, session: "pd" },
    { config: { UDP_PORT: "15422", RNNOISE: "90" }, session: "fd" },
  ];
  const outputs = [{ write: jest.fn() }, { write: jest.fn() }];
  const makeInput = jest.fn((options) => options);
  const rnnoise = {};
  const onError = jest.fn();
  const inputs = createRadioInputs(channels, outputs, rnnoise, makeInput, onError);
  expect(
    inputs.map(({ port, session, rnnoiseMix, onProcessedPcm }) => ({
      port,
      session,
      rnnoiseMix,
      onProcessedPcm,
    })),
  ).toEqual([
    { port: 15581, session: "pd", rnnoiseMix: 0.8, onProcessedPcm: outputs[0].write },
    { port: 15422, session: "fd", rnnoiseMix: 0.9, onProcessedPcm: outputs[1].write },
  ]);
  expect(makeInput).toHaveBeenCalledWith(expect.objectContaining({ rnnoise, onError }));
});
