import { createSocket } from "node:dgram";
import { createAudioTransmission } from "./transmission.mjs";

export function createAudioInput({
  port,
  session,
  rnnoise,
  rnnoiseMix = 1,
  onProcessedPcm,
  createProcessor,
  createTransmissionImpl = createAudioTransmission,
  idleMs = 500,
  onError = () => {},
  createSocketImpl = createSocket,
  now = Date.now,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
  const socket = createSocketImpl("udp4");
  const transmission = createTransmissionImpl({
    session,
    rnnoise,
    rnnoiseMix,
    onProcessedPcm,
    createProcessor,
    idleMs,
    onError,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
  });
  let listening = false;
  socket.on("message", transmission.receive);
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
  const close = async () => {
    await transmission.close();
    try {
      socket.close();
    } catch (error) {
      if (listening || error.code !== "ERR_SOCKET_DGRAM_NOT_RUNNING") throw error;
    }
    listening = false;
  };
  return { close, listen };
}
