import createZelloConnection from "./connection.mjs";

export default function createZelloLifecycle(WebSocketImpl) {
  let connection;
  let online = false;

  function connect(onDisconnected) {
    connection?.close();
    online = false;
    let current;
    const isCurrent = () => connection?.socket === current?.socket;
    current = createZelloConnection(WebSocketImpl, {
      onClose: () => {
        if (!isCurrent()) return;
        online = false;
        onDisconnected(new Error("Zello socket closed"));
      },
      onError: (error) => {
        if (!isCurrent()) return;
        online = false;
        onDisconnected(error);
      },
    });
    connection = current;
    return {
      socket: current.socket,
      opening: current.opening,
      isCurrent,
      setOnline: () => {
        if (connection?.socket === current.socket) online = true;
      },
      close: current.close,
    };
  }

  return {
    connect,
    close() {
      online = false;
      connection?.close();
    },
    healthy: () => online,
    getSocket: () => connection?.socket,
    waitForClose: () => connection?.waitForClose() ?? Promise.resolve(),
  };
}
