import WebSocket from "ws";
import createAuthToken from "./auth.mjs";
import createZelloCommands from "./commands.mjs";
import createZelloAudioSender from "./audio-sender.mjs";
import createZelloStreams from "./streams.mjs";
import createZelloLifecycle from "./lifecycle.mjs";

export default function createZelloSession(config, WebSocketImpl = WebSocket) {
  const lifecycle = createZelloLifecycle(WebSocketImpl);
  let commands;
  const streams = createZelloStreams(config.CHANNEL);
  const sendAudio = createZelloAudioSender({
    getSocket: lifecycle.getSocket,
    isOnline: lifecycle.healthy,
    openState: WebSocketImpl.OPEN,
  });

  async function connect() {
    let currentCommands;
    const current = lifecycle.connect((error) => currentCommands?.close(error));
    const currentSocket = current.socket;
    currentCommands = createZelloCommands(currentSocket, lifecycle.healthy, current.isCurrent);
    commands = currentCommands;
    streams.setRequest(currentCommands.request);
    await current.opening;
    try {
      if (!current.isCurrent()) throw new Error("Zello connection was replaced before login");
      const authToken = createAuthToken({ issuer: config.ISSUER, privateKey: config.PRIVATE_KEY });
      await currentCommands.request(
        {
          command: "logon",
          auth_token: authToken,
          username: config.USERNAME,
          password: config.PASSWORD,
          channels: [config.CHANNEL],
        },
        true,
      );
      if (!current.isCurrent()) throw new Error("Zello connection was replaced during login");
      current.setOnline();
    } catch (error) {
      current.close();
      throw error;
    }
  }
  function close() {
    commands?.close(new Error("Zello session stopped"));
    lifecycle.close();
  }

  return {
    connect,
    close,
    healthy: lifecycle.healthy,
    sendAudio,
    startStream: streams.startStream,
    stopStream: streams.stopStream,
    waitForClose: lifecycle.waitForClose,
  };
}
