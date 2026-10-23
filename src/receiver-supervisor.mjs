import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

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
      const [deviceSerial, authorized] = await Promise.all([
        filesystem.readFile(`${path}/serial`, "utf8"),
        filesystem.readFile(`${path}/authorized`, "utf8"),
      ]);
      if (deviceSerial.trim() === serial && authorized.trim() === "1") return true;
    } catch {}
  }
  return false;
}

export function createReceiverSupervisor({
  receivers,
  spawnProcess = spawn,
  present = hasUsbSerial,
  configFor,
  writeConfig,
  intervalMs = 3000,
}) {
  const states = Object.fromEntries(
    receivers.map(({ channel }) => [channel, { state: "waiting" }]),
  );
  const children = new Map();
  let closed = false;
  const timers = new Map();
  async function poll(receiver) {
    if (closed) return;
    const { channel, serial } = receiver;
    const isPresent = await present(serial);
    if (!isPresent) {
      if (states[channel].state !== "disconnected") children.get(channel)?.kill("SIGTERM");
      states[channel] = { state: "disconnected", serial };
      return;
    }
    if (children.has(channel)) return;
    states[channel] = { state: "starting", serial };
    const configPath = `/tmp/rtl_airband-${channel}.conf`;
    await writeConfig(configPath, configFor(channel));
    const child = spawnProcess("/usr/local/bin/rtl_airband", ["-F", "-e", "-c", configPath], {
      stdio: "inherit",
    });
    children.set(channel, child);
    states[channel] = { state: "running", serial };
    child.once("error", (error) => {
      states[channel] = { state: "error", serial, message: error.message };
      children.delete(channel);
    });
    child.once("close", () => {
      children.delete(channel);
      if (!closed && states[channel].state !== "disconnected") {
        states[channel] = { state: "waiting", serial };
      }
    });
  }
  async function check() {
    await Promise.all(receivers.map(poll));
  }
  const schedule = () => {
    if (closed) return;
    timers.set(
      "poll",
      setTimeout(async () => {
        await check();
        schedule();
      }, intervalMs),
    );
  };
  const ready = () => receivers.every(({ channel }) => states[channel].state === "running");
  const close = async () => {
    closed = true;
    for (const timer of timers.values()) clearTimeout(timer);
    for (const child of children.values()) child.kill("SIGTERM");
    children.clear();
  };
  return { check, close, ready, status: () => structuredClone(states), schedule };
}
