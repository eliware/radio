import { listenForZelloResponses } from "./responses.mjs";

export function createZelloCommands(socket, isOnline, isActive = () => true) {
  let sequence = 0;
  const waiting = new Map();

  function failAll(error) {
    for (const { reject, timer } of waiting.values()) {
      clearTimeout(timer);
      reject(error);
    }
    waiting.clear();
  }

  listenForZelloResponses(socket, isActive, waiting);

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
