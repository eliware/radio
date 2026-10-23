import { createSocket } from "node:dgram";
import { createAudioTransmission } from "./transmission.mjs";

export function createAudioInput({
  port,
  session,
  rnnoise,
  rnnoiseMix = 1,
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
    createProcessor,
    idleMs,
    onError,
    now,
    setTimeoutImpl,
    clearTimeoutImpl,
  });
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
          resolve(socket.address().port);
        });
      } catch (error) {
        failed(error);
      }
    });
  const close = async () => {
    await transmission.close();
    socket.close();
  };
  return { close, listen };
}
