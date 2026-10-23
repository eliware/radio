import { Resampler } from "@eliware/resampler";
import { SAMPLE_RATE } from "./codec.mjs";

const AIRBAND_RATE = 16000;

export function createAudioResampler({
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
      const pcm = Buffer.alloc(floatPcm.length / 2);
      for (let i = 0; i < floatPcm.length / 4; i += 1) {
        const value = floatPcm.readFloatLE(i * 4);
        const clipped = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
        pcm.writeInt16LE(Math.round(clipped * 32767), i * 2);
      }
      stream.write(pcm);
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
