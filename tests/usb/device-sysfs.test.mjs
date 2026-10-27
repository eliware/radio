import { expect, test, jest } from "@jest/globals";
import { hasAuthorizedUsbSerial } from "../../src/usb/device-sysfs.mjs";

test("rejects an unauthorized device with the requested serial", async () => {
  const filesystem = {
    readdir: jest.fn(async () => ["1-3"]),
    readFile: jest.fn(async (path) => {
      if (path.endsWith("1-3/serial")) return "853\n";
      if (path.endsWith("1-3/authorized")) return "0\n";
      throw new Error("missing");
    }),
  };
  await expect(hasAuthorizedUsbSerial("853", "/sys/devices", filesystem)).resolves.toBe(false);
  expect(filesystem.readdir).toHaveBeenCalledWith("/sys/devices");
});

test("returns false when sysfs cannot be read and skips unreadable devices", async () => {
  const filesystem = {
    readdir: jest.fn(async (root) => {
      if (root === "/missing") throw new Error("missing");
      return ["unreadable", "unauthorized"];
    }),
    readFile: jest.fn(async (path) => {
      if (path.includes("unreadable")) throw new Error("missing device field");
      if (path.endsWith("unauthorized/serial")) return "853\n";
      if (path.endsWith("unauthorized/authorized")) return "0\n";
      throw new Error("missing");
    }),
  };
  await expect(hasAuthorizedUsbSerial("851", "/missing", filesystem)).resolves.toBe(false);
  await expect(hasAuthorizedUsbSerial("absent", "/sys/devices", filesystem)).resolves.toBe(false);
  await expect(hasAuthorizedUsbSerial("853", "/sys/devices", filesystem)).resolves.toBe(false);
});
