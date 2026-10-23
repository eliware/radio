import { readdir, readFile } from "node:fs/promises";

export async function hasUsbSerial(
  serial,
  root = "/sys/bus/usb/devices",
  filesystem = { readdir, readFile },
) {
  let devices;
  try {
    devices = await filesystem.readdir(root);
  } catch {
    return false;
  }
  for (const device of devices) {
    try {
      const path = `${root}/${device}`;
      const [value, authorized] = await Promise.all([
        filesystem.readFile(`${path}/serial`, "utf8"),
        filesystem.readFile(`${path}/authorized`, "utf8"),
      ]);
      if (value.trim() === serial && authorized.trim() === "1") return true;
    } catch {}
  }
  return false;
}
