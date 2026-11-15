const maxBufferedBytes = 96000;

export function createBroadcastifyPipePump({ getChild, nextPcm, onError }) {
  let reportedBackpressure = false;

  return () => {
    const child = getChild();
    if (!child) return false;
    if (child.stdin.writableLength > maxBufferedBytes) {
      if (!reportedBackpressure) onError(new Error("Broadcastify audio pipe is congested"));
      reportedBackpressure = true;
      return true;
    }
    reportedBackpressure = false;
    const pcm = nextPcm();
    if (!child.stdin.writable) return true;
    try {
      child.stdin.write(pcm);
    } catch {
      onError(new Error("Broadcastify audio pipe write failed"));
    }
    return true;
  };
}
