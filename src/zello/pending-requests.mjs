export default function createZelloPendingRequests() {
  const waiting = new Map();
  let sequence = 0;
  return {
    nextSequence: () => ++sequence,
    waiting,
    failAll(error) {
      for (const { reject, timer } of waiting.values()) {
        clearTimeout(timer);
        reject(error);
      }
      waiting.clear();
    },
    remove(sequence) {
      waiting.delete(sequence);
    },
  };
}
