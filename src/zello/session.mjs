import WebSocket from "ws";
import { createAuthToken } from "./auth.mjs";
import { createZelloCommands } from "./commands.mjs";
import { createZelloAudioSender } from "./audio-sender.mjs";
import { createZelloStreams } from "./streams.mjs";

export function createZelloSession(config, WebSocketImpl = WebSocket) {
  let socket;
  let online = false;
  let commands;
  let closePromise = Promise.resolve();
  const streams = createZelloStreams(config.CHANNEL);
  const sendAudio = createZelloAudioSender({
    getSocket: () => socket,
    isOnline: () => online,
    openState: WebSocketImpl.OPEN,
  });

  async function connect() {
    socket?.close();
    online = false;
    socket = new WebSocketImpl("wss://zello.io/ws");
    const currentSocket = socket;
    const opening = new Promise((resolve, reject) => {
      const cleanup = () => {
        currentSocket.off("open", opened);
        currentSocket.off("error", failed);
        currentSocket.off("close", closed);
      };
      const opened = () => {
        cleanup();
        resolve();
      };
      const failed = (error) => {
        cleanup();
        reject(error);
      };
      const closed = () => {
        cleanup();
        reject(new Error("Zello closed before connecting"));
      };
      currentSocket.once("open", opened);
      currentSocket.once("error", failed);
      currentSocket.once("close", closed);
    });
    const currentCommands = createZelloCommands(currentSocket, () => online);
    commands = currentCommands;
    streams.setRequest(currentCommands.request);
    closePromise = new Promise((resolve) => currentSocket.once("close", resolve));
    currentSocket.on("close", () => {
      online = false;
      currentCommands.close(new Error("Zello socket closed"));
    });
    currentSocket.on("error", (error) => {
      online = false;
      currentCommands.close(error);
      if (typeof currentSocket.terminate === "function") currentSocket.terminate();
      else currentSocket.close();
    });
    await opening;
    try {
      const authToken = createAuthToken({ issuer: config.ISSUER, privateKey: config.PRIVATE_KEY });
      await commands.request(
        {
          command: "logon",
          auth_token: authToken,
          username: config.USERNAME,
          password: config.PASSWORD,
          channels: [config.CHANNEL],
        },
        true,
      );
      online = true;
    } catch (error) {
      socket.close();
      throw error;
    }
  }
  function close() {
    online = false;
    commands?.close(new Error("Zello session stopped"));
    socket?.close();
  }

  function waitForClose() {
    if (!socket || socket.readyState === WebSocketImpl.CLOSED) return Promise.resolve();
    return closePromise;
  }

  return {
    connect,
    close,
    healthy: () => online,
    sendAudio,
    startStream: streams.startStream,
    stopStream: streams.stopStream,
    waitForClose,
  };
}
