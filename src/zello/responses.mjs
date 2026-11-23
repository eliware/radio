import sanitizeMetadata from "../logging/metadata.mjs";
import { privateKeys } from "../logging/log-record.mjs";
import { knownSecrets } from "../logging/secrets.mjs";

export default function listenForZelloResponses(
  socket,
  isActive,
  waiting,
  onRepeatedInvalid,
  diagnoseResponseValues = false,
) {
  let invalidCount = 0;
  let invalidSince = 0;
  let invalidResponses = [];
  const onMessage = (data) => {
    if (!isActive()) return;
    let response;
    try {
      response = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!response || typeof response !== "object" || Array.isArray(response)) return;
    const sequence =
      typeof response.seq === "number"
        ? response.seq
        : typeof response.seq === "string" && /^\d+$/.test(response.seq)
          ? Number(response.seq)
          : NaN;
    if (!Number.isSafeInteger(sequence)) return;
    const pending = waiting.get(sequence);
    if (!pending) return;
    waiting.delete(sequence);
    clearTimeout(pending.timer);
    if (typeof response.success !== "boolean") {
      const now = Date.now();
      if (invalidCount === 0 || now - invalidSince > 10000) {
        invalidCount = 0;
        invalidSince = now;
        invalidResponses = [];
      }
      invalidCount += 1;
      invalidResponses.push({
        command: pending.command ?? "unknown",
        sequence,
        fields: Object.fromEntries(
          Object.entries(response).map(([key, value]) => [
            key,
            value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
          ]),
        ),
        ...(diagnoseResponseValues && {
          values: sanitizeMetadata(response, knownSecrets, privateKeys),
        }),
      });
      pending.reject(new Error("Invalid Zello response"));
      if (invalidCount === 3)
        onRepeatedInvalid?.(
          new Error(
            `Received ${invalidCount} invalid Zello responses in 10 seconds: ${JSON.stringify(invalidResponses)}`,
          ),
        );
    } else if (response.success) pending.resolve(response);
    else {
      invalidCount = 0;
      invalidResponses = [];
      pending.reject(new Error(response.error ?? "Zello request failed"));
    }
    if (typeof response.success === "boolean" && response.success) {
      invalidCount = 0;
      invalidResponses = [];
    }
  };
  socket.on("message", onMessage);
  return () => socket.off("message", onMessage);
}
