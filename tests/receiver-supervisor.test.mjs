import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createReceiverSupervisor, hasUsbSerial } from "../src/receiver-supervisor.mjs";

test("finds assigned USB serials and handles missing sysfs entries", async () => {
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
  await expect(
    hasUsbSerial("851", "/missing", {
      readdir: async () => {
        throw new Error("missing");
      },
      readFile: filesystem.readFile,
    }),
  ).resolves.toBe(false);
  await expect(hasUsbSerial("radio-test-serial")).resolves.toBe(false);
});

test("supports an empty receiver set with default supervisor dependencies", async () => {
  const supervisor = createReceiverSupervisor({
    receivers: [],
    configFor: () => "",
    writeConfig: async () => {},
  });
  expect(supervisor.ready()).toBe(true);
  await supervisor.close();
});

class Child extends EventEmitter {
  signals = [];
  kill(signal) {
    this.signals.push(signal);
    if (signal === "SIGTERM") this.emit("close", 0);
  }
}

test("starts each receiver independently and restarts it after USB reconnect", async () => {
  const present = { police: true, fire: true };
  const children = [];
  const writeConfig = jest.fn();
  const supervisor = createReceiverSupervisor({
    receivers: [
      { channel: "police", serial: "853" },
      { channel: "fire", serial: "851" },
    ],
    present: async (serial) => present[serial === "853" ? "police" : "fire"],
    configFor: (channel) => channel,
    writeConfig,
    spawnProcess: (...args) => {
      const child = new Child();
      children.push({ child, args });
      return child;
    },
  });
  await supervisor.check();
  expect(supervisor.ready()).toBe(true);
  expect(children).toHaveLength(2);
  expect(children[0].args[1]).toEqual(["-F", "-e", "-c", "/tmp/rtl_airband-police.conf"]);
  present.police = false;
  await supervisor.check();
  expect(supervisor.status().police.state).toBe("disconnected");
  expect(children[0].child.signals).toEqual(["SIGTERM"]);
  children[0].child.emit("close", null);
  expect(supervisor.status().fire.state).toBe("running");
  present.police = true;
  await supervisor.check();
  expect(children).toHaveLength(3);
  expect(supervisor.ready()).toBe(true);
  await supervisor.close();
  expect(children[1].child.signals).toEqual(["SIGTERM"]);
  expect(children[2].child.signals).toEqual(["SIGTERM"]);
  expect(writeConfig).toHaveBeenCalledTimes(3);
});

test("retries a failed receiver and stops scheduled polling on close", async () => {
  jest.useFakeTimers();
  const child = new Child();
  let present = true;
  const supervisor = createReceiverSupervisor({
    receivers: [{ channel: "police", serial: "853" }],
    present: async () => present,
    configFor: () => "config",
    writeConfig: async () => {},
    spawnProcess: () => child,
    intervalMs: 100,
  });
  await supervisor.check();
  child.emit("close", 1);
  expect(supervisor.status().police.state).toBe("waiting");
  supervisor.schedule();
  present = false;
  await jest.advanceTimersByTimeAsync(100);
  expect(supervisor.status().police.state).toBe("disconnected");
  await supervisor.check();
  await supervisor.close();
  await supervisor.check();
  supervisor.schedule();
  await jest.advanceTimersByTimeAsync(500);
  expect(supervisor.status().police.state).toBe("disconnected");
  jest.useRealTimers();
});

test("reports a receiver spawn error and retries on the next poll", async () => {
  const child = new Child();
  const supervisor = createReceiverSupervisor({
    receivers: [{ channel: "police", serial: "853" }],
    present: async () => true,
    configFor: () => "config",
    writeConfig: async () => {},
    spawnProcess: () => child,
  });
  const failed = new Promise((resolve) => {
    child.once("error", resolve);
  });
  await supervisor.check();
  child.emit("error", new Error("spawn failed"));
  await failed;
  expect(supervisor.status().police).toEqual({
    state: "error",
    serial: "853",
    message: "spawn failed",
  });
  await supervisor.check();
  expect(supervisor.status().police.state).toBe("running");
  await supervisor.close();
});
