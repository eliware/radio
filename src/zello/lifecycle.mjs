import { createZelloConnection } from "./connection.mjs";

export function createZelloLifecycle(WebSocketImpl) {
  let connection;
  let online = false;

  function connect(onDisconnected) {
    connection?.close();
    online = false;
    let current;
    current = createZelloConnection(WebSocketImpl, {
      onClose: () => {
        online = false;
        onDisconnected(new Error("Zello socket closed"));
      },
      onError: (error) => {
        online = false;
        onDisconnected(error);
      },
    });
    connection = current;
    return {
      socket: current.socket,
      opening: current.opening,
      isCurrent: () => connection?.socket === current.socket,
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
