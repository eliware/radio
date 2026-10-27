import WebSocket from "ws";
import { createAuthToken } from "./auth.mjs";
import { createZelloCommands } from "./commands.mjs";
import { createZelloAudioSender } from "./audio-sender.mjs";
import { createZelloStreams } from "./streams.mjs";
import { createZelloConnection } from "./connection.mjs";

export function createZelloSession(config, WebSocketImpl = WebSocket) {
  let connection;
  let online = false;
  let commands;
  const streams = createZelloStreams(config.CHANNEL);
  const sendAudio = createZelloAudioSender({
    getSocket: () => connection?.socket,
    isOnline: () => online,
    openState: WebSocketImpl.OPEN,
  });

  async function connect() {
    connection?.close();
    online = false;
    let currentCommands;
    connection = createZelloConnection(WebSocketImpl, {
      onClose: () => {
        online = false;
        currentCommands?.close(new Error("Zello socket closed"));
      },
      onError: (error) => {
        online = false;
        currentCommands?.close(error);
      },
    });
    const currentSocket = connection.socket;
    currentCommands = createZelloCommands(currentSocket, () => online);
    commands = currentCommands;
    streams.setRequest(currentCommands.request);
    await connection.opening;
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
      connection.close();
      throw error;
    }
  }
  function close() {
    online = false;
    commands?.close(new Error("Zello session stopped"));
    connection?.close();
  }

  function waitForClose() {
    return connection?.waitForClose() ?? Promise.resolve();
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
