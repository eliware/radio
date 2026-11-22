import createZelloOpening from "./opening.mjs";

const URL = "wss://zello.io/ws";

export default function createZelloConnection(
  WebSocketImpl,
  { onClose = () => {}, onError = () => {} } = {},
) {
  const socket = new WebSocketImpl(URL);
  const opening = createZelloOpening(socket, WebSocketImpl.CLOSED);

  let closingAfterError = false;
  socket.on("close", onClose);
  socket.on("error", (error) => {
    onError(error);
    if (closingAfterError || socket.readyState === WebSocketImpl.CLOSED) return;
    closingAfterError = true;
    if (typeof socket.terminate === "function") socket.terminate();
    else socket.close();
  });

  return {
    socket,
    opening: opening.opening,
    close: () => socket.close(),
    waitForClose: opening.waitForClose,
  };
}
