import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createZelloCommands } from "../../src/zello/commands.mjs";

class Socket extends EventEmitter {
  send(value) {
    this.last = JSON.parse(value);
  }
}

test("rejects offline requests and synchronous send errors", async () => {
  const offline = createZelloCommands(new Socket(), () => false);
  await expect(offline.request({ command: "logon" })).rejects.toThrow("offline");
  const socket = new Socket();
  socket.send = () => {
    throw new Error("send error");
  };
  await expect(
    createZelloCommands(socket, () => true).request({ command: "logon" }),
  ).rejects.toThrow("send error");
});

test("defaults to accepting responses from the current socket", async () => {
  const socket = new Socket();
  const commands = createZelloCommands(socket, () => true);
  const pending = commands.request({ command: "logon" });
  socket.emit("message", Buffer.from(JSON.stringify({ seq: socket.last.seq, success: true })));
  await expect(pending).resolves.toMatchObject({ success: true });
});

test("fails pending commands when the connection closes or a request times out", async () => {
  jest.useFakeTimers();
  const socket = new Socket();
  const commands = createZelloCommands(socket, () => true);
  const closed = commands.request({ command: "logon" });
  commands.close(new Error("socket closed"));
  await expect(closed).rejects.toThrow("socket closed");
  const timeout = commands.request({ command: "start_stream" });
  const timeoutResult = expect(timeout).rejects.toThrow("timed out");
  await jest.advanceTimersByTimeAsync(10000);
  await timeoutResult;
  jest.useRealTimers();
});
