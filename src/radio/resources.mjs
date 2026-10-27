export async function closeRadioResources(
  { inputs = [], broadcastify, sessions, airband },
  { ignoreErrors = false } = {},
) {
  const close = [
    ...inputs.map((input) => () => input.close()),
    ...(broadcastify ? [() => broadcastify.close()] : []),
    ...(sessions ? [() => sessions.close()] : []),
    ...(airband ? [() => airband.close()] : []),
  ];
  const results = await Promise.allSettled(
    close.map((resourceClose) => Promise.resolve().then(resourceClose)),
  );
  const failure = results.find(({ status }) => status === "rejected");
  if (!ignoreErrors && failure) throw failure.reason;
}
