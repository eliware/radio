export const SAMPLE_RATE = 48000;
export const FRAME_SAMPLES = 960;
export const FRAME_BYTES = FRAME_SAMPLES * 4;

export function codecHeader() {
  const header = Buffer.alloc(4);
  header.writeUInt16LE(SAMPLE_RATE);
  header.writeUInt8(1, 2);
  header.writeUInt8(20, 3);
  return header.toString("base64");
}
