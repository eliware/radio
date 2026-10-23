#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { createIcecastConfig } from "../src/icecast-config.mjs";
import { probeTcp, startServiceSupervisor } from "../src/service-supervisor.mjs";

let command;
let startupError = "";
try {
  const config = createIcecastConfig(process.env.ICECAST_SOURCE_PASSWORD);
  await writeFile("/tmp/icecast.xml", config, { mode: 0o600 });
  command = "/usr/bin/icecast2";
} catch (error) {
  startupError = error.message;
  console.error(startupError);
}

await startServiceSupervisor({
  command,
  args: command ? ["-n", "-c", "/tmp/icecast.xml"] : [],
  port: Number(process.env.ICECAST_HEALTH_PORT ?? 9102),
  startupError,
  readyCheck: () => probeTcp("127.0.0.1", 8000),
});
