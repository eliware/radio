import { Resampler } from "@eliware/resampler";
import { SAMPLE_RATE } from "./codec.mjs";
import convertFloatPcmToS16le from "./pcm-conversion.mjs";

const AIRBAND_RATE = 16000;

export default function createAudioResampler({
  onPcm,
  onError = () => {},
  createStreamImpl = (options) => new Resampler(options),
}) {
  let stream;
  let closed = false;

  function createStream() {
    const next = createStreamImpl({ inRate: AIRBAND_RATE, outRate: SAMPLE_RATE });
    next.on("data", onPcm);
    next.on("error", onError);
    return next;
  }

  stream = createStream();
  return {
    write(floatPcm) {
      if (closed) throw new Error("Audio resampler is closed");
      if (floatPcm.length % 4) throw new Error("Airband audio must contain float32 samples");
      stream.write(convertFloatPcmToS16le(floatPcm));
    },
    reset() {
      if (closed) return;
      stream.destroy();
      stream = createStream();
    },
    close() {
      if (closed) return;
      closed = true;
      stream.destroy();
    },
  };
}
