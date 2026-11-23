import { expect, jest, test } from "@jest/globals";
import createRadioChannels from "../../src/radio/channels.mjs";

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
