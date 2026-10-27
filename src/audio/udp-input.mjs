import { createSocket } from "node:dgram";

export function createUdpInput({
  port,
  onMessage,
  onError = () => {},
  createSocketImpl = createSocket,
}) {
  const socket = createSocketImpl("udp4");
  let listening = false;
  let binding = false;
  let closed = false;
  let cancelBinding;
  socket.on("message", onMessage);
  const handleError = (error) => {
    if (!binding && !closed) onError(error);
  };
  socket.on("error", handleError);

  const listen = () =>
    new Promise((resolve, reject) => {
      if (closed || listening || binding) {
        reject(new Error("UDP input is already listening or closed"));
        return;
      }
      binding = true;
      const failed = (error) => {
        binding = false;
        cancelBinding = undefined;
        socket.off("error", failed);
        reject(error);
      };
      cancelBinding = () => failed(new Error("UDP input closed while binding"));
      socket.once("error", failed);
      try {
        socket.bind(port, "127.0.0.1", () => {
          socket.off("error", failed);
          binding = false;
          cancelBinding = undefined;
          listening = true;
          resolve(socket.address().port);
        });
      } catch (error) {
        failed(error);
      }
    });

  const close = () => {
    if (closed) return;
    cancelBinding?.();
    closed = true;
    socket.off("error", handleError);
    socket.off("message", onMessage);
    try {
      socket.close();
    } catch (error) {
      if (listening || error.code !== "ERR_SOCKET_DGRAM_NOT_RUNNING") throw error;
    }
    listening = false;
  };

  return { close, listen };
}
