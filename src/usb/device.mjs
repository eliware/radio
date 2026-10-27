import { readdir, readFile } from "node:fs/promises";
import { hasAuthorizedUsbSerial } from "./device-sysfs.mjs";

export function createUsbDeviceLookup(filesystem = { readdir, readFile }) {
  return (serial, root = "/sys/bus/usb/devices") =>
    hasAuthorizedUsbSerial(serial, root, filesystem);
}

export const hasUsbSerial = createUsbDeviceLookup();
