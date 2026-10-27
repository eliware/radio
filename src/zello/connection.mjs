const URL = "wss://zello.io/ws";

export function createZelloConnection(
  WebSocketImpl,
  { onClose = () => {}, onError = () => {} } = {},
) {
  const socket = new WebSocketImpl(URL);
  const opening = new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off("open", opened);
      socket.off("error", failed);
      socket.off("close", closed);
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
    socket.once("open", opened);
    socket.once("error", failed);
    socket.once("close", closed);
  });
  const closed = new Promise((resolve) => socket.once("close", resolve));

  socket.on("close", onClose);
  socket.on("error", (error) => {
    onError(error);
    if (typeof socket.terminate === "function") socket.terminate();
    else socket.close();
  });

  return {
    socket,
    opening,
    close: () => socket.close(),
    waitForClose: () => (socket.readyState === WebSocketImpl.CLOSED ? Promise.resolve() : closed),
  };
}
