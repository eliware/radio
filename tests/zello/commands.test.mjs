import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import { createZelloCommands } from "../../src/zello/commands.mjs";

class Socket extends EventEmitter {
  send(value) {
    this.last = JSON.parse(value);
  }
}

test("resolves success and rejects Zello command failures", async () => {
  const socket = new Socket();
  const commands = createZelloCommands(socket, () => true);
  const result = commands.request({ command: "start_stream" });
  socket.emit("message", Buffer.from("invalid"));
  socket.emit("message", Buffer.from(JSON.stringify({ seq: 99, success: true })));
  socket.emit("message", Buffer.from(JSON.stringify({ seq: socket.last.seq, success: true })));
  await expect(result).resolves.toMatchObject({ success: true });
  const failure = commands.request({ command: "stop_stream" });
  socket.emit(
    "message",
    Buffer.from(JSON.stringify({ seq: socket.last.seq, success: false, error: "denied" })),
  );
  await expect(failure).rejects.toThrow("denied");
  const noMessage = commands.request({ command: "stop_stream" });
  socket.emit("message", Buffer.from(JSON.stringify({ seq: socket.last.seq, success: false })));
  await expect(noMessage).rejects.toThrow("Zello request failed");
});

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
