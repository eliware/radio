export default function createDenoiserFrameProcessor({
  frameSize,
  processFrame,
  rnnoiseMix,
  onPcm,
}) {
  const frameBytes = frameSize * 2;

  return (buffered) => {
    const original = Float32Array.from(
      { length: frameSize },
      (_, i) => buffered.readInt16LE(i * 2) / 32768,
    );
    const frame = Float32Array.from(original);
    processFrame(frame);
    const output = Buffer.alloc(frameBytes);
    for (let i = 0; i < frame.length; i += 1) {
      const mixed = (frame[i] * rnnoiseMix + original[i] * (1 - rnnoiseMix)) * 32768;
      output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mixed))), i * 2);
    }
    onPcm(output);
  };
}
