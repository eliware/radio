import { spawn } from "node:child_process";
import { hasUsbSerial } from "./usb-device.mjs";

function stop(entry) {
  for (const child of Object.values(entry ?? {})) child?.kill("SIGTERM");
}

export function createReceiverSupervisor({
  receivers,
  spawnProcess = spawn,
  present = hasUsbSerial,
  configFor,
  processorArgsFor,
  writeConfig,
  intervalMs = 3000,
}) {
  const states = Object.fromEntries(
    receivers.map(({ channel }) => [channel, { state: "waiting" }]),
  );
  const children = new Map();
  let closed = false;
  let timer;

  async function poll(receiver) {
    if (closed) return;
    const { channel, serial } = receiver;
    if (!(await present(serial))) {
      const entry = children.get(channel);
      children.delete(channel);
      stop(entry);
      states[channel] = { state: "disconnected", serial };
      return;
    }
    if (children.has(channel)) return;
    states[channel] = { state: "starting", serial };
    const entry = {};
    try {
      await writeConfig(`/tmp/rtl_airband-${channel}.conf`, configFor(channel));
      if (processorArgsFor)
        entry.audio = spawnProcess("/usr/bin/ffmpeg", processorArgsFor(channel), {
          stdio: "inherit",
        });
      entry.receiver = spawnProcess(
        "/usr/local/bin/rtl_airband",
        ["-F", "-e", "-c", `/tmp/rtl_airband-${channel}.conf`],
        { stdio: "inherit" },
      );
      children.set(channel, entry);
      states[channel] = { state: "running", serial };
      for (const [kind, child] of Object.entries(entry)) {
        child.once("error", (error) => fail(channel, entry, serial, error.message));
        child.once("close", () => ended(channel, entry, serial, kind));
      }
    } catch (error) {
      stop(entry);
      states[channel] = { state: "error", serial, message: error.message };
    }
  }

  function fail(channel, entry, serial, message) {
    if (children.get(channel) !== entry) return;
    children.delete(channel);
    stop(entry);
    states[channel] = { state: "error", serial, message };
  }

  function ended(channel, entry, serial, kind) {
    if (children.get(channel) !== entry) return;
    children.delete(channel);
    stop(entry);
    states[channel] = { state: kind === "receiver" ? "waiting" : "error", serial };
  }

  const check = () => Promise.all(receivers.map(poll));
  const schedule = () => {
    if (!closed)
      timer = setTimeout(async () => {
        await check();
        schedule();
      }, intervalMs);
  };
  const close = async () => {
    closed = true;
    clearTimeout(timer);
    const active = [...children.values()];
    children.clear();
    for (const entry of active) stop(entry);
  };
  return {
    check,
    close,
    ready: () => receivers.every(({ channel }) => states[channel].state === "running"),
    status: () => structuredClone(states),
    schedule,
  };
}

export { hasUsbSerial } from "./usb-device.mjs";
