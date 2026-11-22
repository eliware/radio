export default function convertFloatPcmToS16le(floatPcm) {
  const pcm = Buffer.alloc(floatPcm.length / 2);
  for (let i = 0; i < floatPcm.length / 4; i += 1) {
    const value = floatPcm.readFloatLE(i * 4);
    const clipped = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    pcm.writeInt16LE(Math.round(clipped * 32767), i * 2);
  }
  return pcm;
}
