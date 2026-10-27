import { expect, jest, test } from "@jest/globals";
import { createAudioInput } from "../../src/audio/input.mjs";

test("connects UDP input to the transmission and closes both resources", async () => {
  const events = [];
  const transmission = {
    receive: jest.fn((packet) => events.push(packet)),
    close: jest.fn(async () => events.push("transmission closed")),
  };
  const udpInput = {
    listen: jest.fn(async () => 12001),
    close: jest.fn(async () => events.push("UDP input closed")),
  };
  const onError = jest.fn();
  let udpOptions;
  const input = createAudioInput({
    port: 12001,
    session: {},
    onError,
    createTransmissionImpl: jest.fn(() => transmission),
    createUdpInputImpl: jest.fn((options) => {
      udpOptions = options;
      return udpInput;
    }),
  });

  expect(udpOptions).toMatchObject({ port: 12001, onError });
  expect(udpOptions.onMessage).toBe(transmission.receive);
  await expect(input.listen()).resolves.toBe(12001);
  const packet = Buffer.alloc(16);
  udpOptions.onMessage(packet);
  expect(transmission.receive).toHaveBeenCalledWith(packet);

  await input.close();
  expect(events).toEqual([packet, "transmission closed", "UDP input closed"]);
});

test("uses the default transmission, UDP input, and no-op error handler", async () => {
  const rnnoise = {
    frameSize: 480,
    createDenoiseState: () => ({ processFrame: () => 0, destroy: () => {} }),
  };
  const input = createAudioInput({
    port: 0,
    session: { healthy: () => false },
    rnnoise,
    createUdpInputImpl: (options) => {
      expect(() => options.onError(new Error("ignored"))).not.toThrow();
      return { listen: async () => 12001, close: async () => {} };
    },
  });
  await expect(input.listen()).resolves.toBe(12001);
  await input.close();

  const defaultInput = createAudioInput({
    port: 0,
    session: { healthy: () => false },
    rnnoise,
  });
  expect(await defaultInput.listen()).toBeGreaterThan(0);
  await defaultInput.close();
});
