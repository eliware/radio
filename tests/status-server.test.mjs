import { createStatusServer } from "../src/status-server.mjs";

async function fetchStatus(ready, fetchImpl = fetch) {
  const log = { debug: () => {} };
  const server = createStatusServer(
    {
      ready: () => ready,
      status: () => ({ receiver: { state: "running" }, channels: { PD: { state: "online" } } }),
    },
    log,
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await Promise.all(
      ["/health", "/ready", "/missing"].map((route) =>
        fetchImpl(`http://127.0.0.1:${port}${route}`).then(async (response) => ({
          status: response.status,
          body: response.status === 404 ? "" : await response.json(),
        })),
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("health stays live while readiness requires Airband and Zello", async () => {
  const [health, ready, missing] = await fetchStatus(false);
  expect(health.status).toBe(200);
  expect(ready.status).toBe(503);
  expect(ready.body.channels.PD.state).toBe("online");
  expect(missing.status).toBe(404);
  expect((await fetchStatus(true))[1].status).toBe(200);
});

test("creates a status server with the shared logger by default", () => {
  const server = createStatusServer({ ready: () => true, status: () => ({}) });
  expect(server).toBeDefined();
});
