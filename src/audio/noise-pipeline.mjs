import { createAudioPacketizer } from "./packetizer.mjs";
import { createAudioResampler } from "./resampler.mjs";
import { createAudioDenoiser } from "./denoiser.mjs";

export function createNoisePipeline({
  rnnoise,
  rnnoiseMix = 1,
  onPacket,
  onProcessedPcm = () => {},
  onError = () => {},
}) {
  let closed = false;
  const packetizer = createAudioPacketizer({ onPacket });
  const denoiser = createAudioDenoiser({
    rnnoise,
    rnnoiseMix,
    onPcm: (pcm) => {
      onProcessedPcm(pcm);
      packetizer.write(pcm);
    },
    onError,
  });
  const resampler = createAudioResampler({ onPcm: denoiser.write, onError });
  return {
    write: (floatPcm) => {
      if (closed) throw new Error("Audio pipeline is closed");
      resampler.write(floatPcm);
    },
    finishTransmission: () => {
      if (closed) return;
      denoiser.reset();
      packetizer.reset();
      resampler.reset();
    },
    close: () => {
      if (closed) return;
      closed = true;
      resampler.close();
      denoiser.close();
      packetizer.close();
    },
  };
}
