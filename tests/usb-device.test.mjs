import { expect, test, jest } from "@jest/globals";
import { hasUsbSerial } from "../src/usb-device.mjs";

test("finds only authorized assigned USB dongles", async () => {
  const filesystem = {
    readdir: jest.fn(async () => ["1-2", "1-3"]),
    readFile: jest.fn(async (path) => {
      if (path.endsWith("1-2/serial")) return "851\n";
      if (path.endsWith("1-2/authorized")) return "1\n";
      if (path.endsWith("1-3/serial")) return "853\n";
      if (path.endsWith("1-3/authorized")) return "0\n";
      throw new Error("missing");
    }),
  };
  await expect(hasUsbSerial("851", "/sys/devices", filesystem)).resolves.toBe(true);
  await expect(hasUsbSerial("853", "/sys/devices", filesystem)).resolves.toBe(false);
  await expect(hasUsbSerial("radio-test-serial")).resolves.toBe(false);
  await expect(
    hasUsbSerial("851", "/missing", {
      readdir: async () => {
        throw new Error("missing");
      },
      readFile: filesystem.readFile,
    }),
  ).resolves.toBe(false);
});
