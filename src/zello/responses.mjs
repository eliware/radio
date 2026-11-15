export function listenForZelloResponses(socket, isActive, waiting) {
  const onMessage = (data) => {
    if (!isActive()) return;
    let response;
    try {
      response = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!response || typeof response !== "object" || Array.isArray(response)) return;
    const pending = waiting.get(response.seq);
    if (!pending) return;
    waiting.delete(response.seq);
    clearTimeout(pending.timer);
    if (typeof response.success !== "boolean") pending.reject(new Error("Invalid Zello response"));
    else if (response.success) pending.resolve(response);
    else pending.reject(new Error(response.error ?? "Zello request failed"));
  };
  socket.on("message", onMessage);
  return () => socket.off("message", onMessage);
}
