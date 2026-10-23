export function createZelloAudioSender({ getSocket, isOnline, openState }) {
  return (streamId, packet) => {
    const socket = getSocket();
    if (!isOnline() || socket.readyState !== openState) throw new Error("Zello is offline");
    const header = Buffer.alloc(9);
    header.writeUInt8(1, 0);
    header.writeUInt32BE(streamId, 1);
    header.writeUInt32BE(0, 5);
    socket.send(Buffer.concat([header, packet]), { binary: true });
  };
}
