import { expect, jest, test } from "@jest/globals";
import { createStatusServer } from "../../src/status/server.mjs";

async function fetchStatus(
  ready,
  fetchImpl = fetch,
  method = "GET",
  status = () => ({
    receiver: { state: "running" },
    channels: { PD: { state: "online" } },
  }),
) {
  const log = { debug: () => {} };
  const server = createStatusServer(
    {
      ready: () => ready,
      status,
    },
    log,
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await Promise.all(
      ["/health", "/ready", "/missing"].map((route) =>
        fetchImpl(`http://127.0.0.1:${port}${route}`, { method }).then(async (response) => ({
          status: response.status,
          body: [404, 405].includes(response.status) ? "" : await response.json(),
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

test("rejects non-GET status requests without reading runtime state", async () => {
  const status = jest.fn(() => ({}));
  const [health, ready, missing] = await fetchStatus(true, fetch, "POST", status);
  expect(health.status).toBe(405);
  expect(ready.status).toBe(405);
  expect(missing.status).toBe(404);
  expect(status).not.toHaveBeenCalled();
});
