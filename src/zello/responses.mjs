export default function listenForZelloResponses(socket, isActive, waiting, onRepeatedInvalid) {
  let invalidCount = 0;
  let invalidSince = 0;
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
      }
      invalidCount += 1;
      pending.reject(new Error("Invalid Zello response"));
      if (invalidCount === 3)
        onRepeatedInvalid?.(
          new Error(`Received ${invalidCount} invalid Zello responses in 10 seconds`),
        );
    } else if (response.success) pending.resolve(response);
    else {
      invalidCount = 0;
      pending.reject(new Error(response.error ?? "Zello request failed"));
    }
    if (typeof response.success === "boolean" && response.success) invalidCount = 0;
  };
  socket.on("message", onMessage);
  return () => socket.off("message", onMessage);
}
