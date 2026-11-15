export function listenForZelloResponses(socket, isActive, waiting) {
  socket.on("message", (data) => {
    if (!isActive()) return;
    let response;
    try {
      response = JSON.parse(data.toString());
    } catch {
      return;
    }
    const pending = waiting.get(response.seq);
    if (!pending) return;
    waiting.delete(response.seq);
    clearTimeout(pending.timer);
    if (response.success) pending.resolve(response);
    else pending.reject(new Error(response.error ?? "Zello request failed"));
  });
}
