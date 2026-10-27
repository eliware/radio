import { expect, test, jest } from "@jest/globals";
import { createUsbDeviceLookup } from "../../src/usb/device.mjs";

test("looks up an assigned USB dongle through the public helper", async () => {
  const filesystem = {
    readdir: jest.fn(async () => ["1-2"]),
    readFile: jest.fn(async (path) => {
      if (path.endsWith("1-2/serial")) return "851\n";
      if (path.endsWith("1-2/authorized")) return "1\n";
      throw new Error("missing");
    }),
  };
  const lookup = createUsbDeviceLookup(filesystem);
  await expect(lookup("851", "/sys/devices")).resolves.toBe(true);
  expect(filesystem.readdir).toHaveBeenCalledWith("/sys/devices");
});

test("uses the default sysfs path", async () => {
  expect(createUsbDeviceLookup()).toEqual(expect.any(Function));
  const filesystem = { readdir: jest.fn(async () => []), readFile: jest.fn() };
  const lookup = createUsbDeviceLookup(filesystem);
  await expect(lookup("absent")).resolves.toBe(false);
  expect(filesystem.readdir).toHaveBeenCalledWith("/sys/bus/usb/devices");
});
