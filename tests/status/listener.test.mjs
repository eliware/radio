import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";
import startStatusListener from "../../src/status/listener.mjs";
import readStatusPort from "../../src/status/read-port.mjs";

function fakeServer(fail = false) {
  const server = new EventEmitter();
  server.listening = false;
  server.listen = jest.fn((_port, _host, ready) => {
    if (fail) server.emit("error", new Error("listen failed"));
    else {
      server.listening = true;
      ready();
    }
  });
  server.close = jest.fn((callback) => {
    server.listening = false;
    callback?.();
  });
  return server;
}

test("starts and reports the status listener using the configured port", async () => {
  const server = fakeServer();
  const log = { info: jest.fn() };
  const onServer = jest.fn();
  const createServer = jest.fn(() => server);

  await expect(
    startStatusListener({}, { log, onServer, port: "1401", createServer }),
  ).resolves.toBe(server);

  expect(createServer).toHaveBeenCalledWith({}, log);
  expect(onServer).toHaveBeenCalledWith(server);
  expect(server.listen).toHaveBeenCalledWith(1401, "0.0.0.0", expect.any(Function));
  expect(log.info).toHaveBeenCalledWith("Radio service started", { port: 1401 });
});

test("rejects when the status listener cannot bind", async () => {
  const server = fakeServer(true);
  const onServer = jest.fn();
  await expect(
    startStatusListener(
      {},
      {
        log: { info: () => {} },
        onServer,
        port: 1400,
        createServer: () => server,
      },
    ),
  ).rejects.toThrow("listen failed");
  expect(onServer).toHaveBeenCalledWith(server);
  expect(server.close).toHaveBeenCalledTimes(1);
});

test("uses the environment port and default status server factory", async () => {
  const previousPort = process.env.RADIO_HEALTH_PORT;
  process.env.RADIO_HEALTH_PORT = "0";
  let server;
  try {
    server = await startStatusListener(
      { ready: () => true, status: () => ({}) },
      { log: { info: () => {} }, onServer: (instance) => (server = instance) },
    );
    expect(server.address().port).toBeGreaterThan(0);
  } finally {
    if (previousPort === undefined) delete process.env.RADIO_HEALTH_PORT;
    else process.env.RADIO_HEALTH_PORT = previousPort;
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
  }
});

test("uses the default health port when the environment is unset", async () => {
  const previousPort = process.env.RADIO_HEALTH_PORT;
  delete process.env.RADIO_HEALTH_PORT;
  const server = fakeServer();
  try {
    await startStatusListener(
      {},
      {
        log: { info: () => {} },
        onServer: () => {},
        createServer: () => server,
      },
    );
    expect(server.listen).toHaveBeenCalledWith(1400, "0.0.0.0", expect.any(Function));
  } finally {
    if (previousPort !== undefined) process.env.RADIO_HEALTH_PORT = previousPort;
  }
});

test("validates the health port before listener creation", async () => {
  const createServer = jest.fn();
  expect(readStatusPort("1400")).toBe(1400);
  for (const port of ["-1", "65536", "not-a-port", "1.5"]) {
    expect(() => readStatusPort(port)).toThrow("RADIO_HEALTH_PORT must be an integer");
    await expect(
      startStatusListener(
        {},
        {
          log: { info: () => {} },
          onServer: () => {},
          port,
          createServer,
        },
      ),
    ).rejects.toThrow("RADIO_HEALTH_PORT must be an integer");
  }
  expect(createServer).not.toHaveBeenCalled();
});
