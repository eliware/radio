export function createZelloOpening(socket, closedState) {
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

  return {
    opening,
    waitForClose: () => (socket.readyState === closedState ? Promise.resolve() : closed),
  };
}
