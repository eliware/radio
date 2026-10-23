#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { createSdrConfig } from "../src/sdr-config.mjs";
import { probeTcp, startServiceSupervisor } from "../src/service-supervisor.mjs";

let command;
let startupError = "";
try {
  await writeFile("/tmp/rtl_airband.conf", createSdrConfig(process.env), { mode: 0o600 });
  command = "/usr/local/bin/rtl_airband";
} catch (error) {
  startupError = error.message;
  console.error(startupError);
}

await startServiceSupervisor({
  command,
  args: command ? ["-F", "-e", "-c", "/tmp/rtl_airband.conf"] : [],
  port: Number(process.env.SDR_HEALTH_PORT ?? 9101),
  startupError,
  readyCheck: () => probeTcp("icecast", 8000),
});
