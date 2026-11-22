import { safeSerialize } from "@eliware/common";
import redactStrings from "./string-redaction.mjs";

export default function sanitizeMetadata(metadata, secrets, keys) {
  return redactStrings(safeSerialize(metadata, { keys }), secrets);
}
