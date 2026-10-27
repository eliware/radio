import { createAudioTransmission } from "./transmission.mjs";
import { createUdpInput } from "./udp-input.mjs";

export function createAudioInput({
  port,
  session,
  rnnoise,
  rnnoiseMix = 1,
  onProcessedPcm,
  createProcessor,
  createTransmissionImpl = createAudioTransmission,
  createUdpInputImpl = createUdpInput,
  idleMs = 500,
  onError = () => {},
  now = Date.now,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
}) {
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
  const input = createUdpInputImpl({
    port,
    onMessage: transmission.receive,
    onError,
  });
  const close = async () => {
    await transmission.close();
    await input.close();
  };
  return { close, listen: input.listen };
}
