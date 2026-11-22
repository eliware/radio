export default function createRadioInputs(channels, outputs, rnnoise, makeInput, onError) {
  return channels.map(({ session, config }, index) =>
    makeInput({
      port: Number(config.UDP_PORT),
      session,
      rnnoise,
      rnnoiseMix: Number(config.RNNOISE) / 100,
      onProcessedPcm: outputs[index].write,
      onError,
    }),
  );
}
