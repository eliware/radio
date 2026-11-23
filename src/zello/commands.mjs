import listenForZelloResponses from "./responses.mjs";
import createZelloPendingRequests from "./pending-requests.mjs";

export default function createZelloCommands(
  socket,
  isOnline,
  isActive = () => true,
  onRepeatedInvalid,
  diagnoseResponseValues = process.env.RADIO_ZELLO_DEBUG_RESPONSES === "true",
) {
  const pendingRequests = createZelloPendingRequests();
  const { waiting } = pendingRequests;

  const removeResponseListener = listenForZelloResponses(
    socket,
    isActive,
    waiting,
    onRepeatedInvalid,
    diagnoseResponseValues,
  );

  function request(command, allowOffline = false) {
    if (!allowOffline && !isOnline()) return Promise.reject(new Error("Zello is offline"));
    const seq = pendingRequests.nextSequence();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.remove(seq);
        reject(new Error(`Zello ${command.command} timed out`));
      }, 10000);
      waiting.set(seq, { resolve, reject, timer, command: command.command });
      try {
        socket.send(JSON.stringify({ ...command, seq }));
      } catch (error) {
        clearTimeout(timer);
        pendingRequests.remove(seq);
        reject(error);
      }
    });
  }

  return {
    close(error) {
      removeResponseListener();
      pendingRequests.failAll(error);
    },
    request,
  };
}
