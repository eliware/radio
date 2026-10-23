#!/usr/bin/env node
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { createReceiverSupervisor } from "../src/receiver-supervisor.mjs";
import { createSdrConfig } from "../src/sdr-config.mjs";

const env = process.env;
createSdrConfig(env);
const receivers = [
  { channel: "police", serial: env.RADIO_POLICE_SDR_SERIAL },
  { channel: "fire", serial: env.RADIO_FIRE_SDR_SERIAL },
];
const supervisor = createReceiverSupervisor({
  receivers,
  configFor: (channel) => createSdrConfig(env, channel),
  writeConfig: (path, config) => writeFile(path, config, { mode: 0o600 }),
});
const server = createServer((request, response) => {
  const status = supervisor.status();
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" }).end('{"status":"ok"}');
  } else if (request.url === "/status") {
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(status));
  } else if (request.url === "/ready") {
    const ready = supervisor.ready();
    response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ status: ready ? "ready" : "receiver-unavailable", channels: status }),
    );
  } else response.writeHead(404).end();
});
server.listen(Number(env.SDR_HEALTH_PORT ?? 9101), "0.0.0.0", async () => {
  await supervisor.check();
  supervisor.schedule();
});
const close = async () => {
  await supervisor.close();
  server.close();
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
