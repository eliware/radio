export function createZelloCommands(socket, isOnline) {
  let sequence = 0;
  const waiting = new Map();

  function failAll(error) {
    for (const { reject, timer } of waiting.values()) {
      clearTimeout(timer);
      reject(error);
    }
    waiting.clear();
  }

  socket.on("message", (data) => {
    let response;
    try {
      response = JSON.parse(data.toString());
    } catch {
      return;
    }
    const pending = waiting.get(response.seq);
    if (!pending) return;
    waiting.delete(response.seq);
    clearTimeout(pending.timer);
    if (response.success) pending.resolve(response);
    else pending.reject(new Error(response.error ?? "Zello request failed"));
  });

  function request(command, allowOffline = false) {
    if (!allowOffline && !isOnline()) return Promise.reject(new Error("Zello is offline"));
    const seq = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(seq);
        reject(new Error(`Zello ${command.command} timed out`));
      }, 10000);
      waiting.set(seq, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ ...command, seq }));
      } catch (error) {
        clearTimeout(timer);
        waiting.delete(seq);
        reject(error);
      }
    });
  }

  return { close: failAll, request };
}
