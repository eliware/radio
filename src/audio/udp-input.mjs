import { createSocket } from "node:dgram";

export function createUdpInput({
  port,
  onMessage,
  onError = () => {},
  createSocketImpl = createSocket,
}) {
  const socket = createSocketImpl("udp4");
  let listening = false;
  socket.on("message", onMessage);
  socket.on("error", onError);

  const listen = () =>
    new Promise((resolve, reject) => {
      const failed = (error) => {
        socket.off("error", failed);
        reject(error);
      };
      socket.once("error", failed);
      try {
        socket.bind(port, "127.0.0.1", () => {
          socket.off("error", failed);
          listening = true;
          resolve(socket.address().port);
        });
      } catch (error) {
        failed(error);
      }
    });

  const close = () => {
    try {
      socket.close();
    } catch (error) {
      if (listening || error.code !== "ERR_SOCKET_DGRAM_NOT_RUNNING") throw error;
    }
    listening = false;
  };

  return { close, listen };
}
