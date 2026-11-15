const maxBufferedBytes = 96000;

export function createBroadcastifyPipePump({ getChild, nextPcm, onError }) {
  let reportedPipeIssue = false;

  return () => {
    const child = getChild();
    if (!child) return false;
    if (child.stdin.writableLength > maxBufferedBytes) {
      if (!reportedPipeIssue) onError(new Error("Broadcastify audio pipe is congested"));
      reportedPipeIssue = true;
      return true;
    }
    if (!child.stdin.writable) {
      if (!reportedPipeIssue) onError(new Error("Broadcastify audio pipe is not writable"));
      reportedPipeIssue = true;
      return true;
    }
    reportedPipeIssue = false;
    const pcm = nextPcm();
    try {
      child.stdin.write(pcm);
    } catch {
      onError(new Error("Broadcastify audio pipe write failed"));
    }
    return true;
  };
}
