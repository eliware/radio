import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { connect } from "node:net";

export function probeTcp(host, port, connectSocket = connect) {
  return new Promise((resolve) => {
    const socket = connectSocket({ host, port });
    const finish = (ready) => {
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(1000, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function startServiceSupervisor({
  command,
  args = [],
  port,
  readyCheck = async () => true,
  startupError = "",
  spawnProcess = spawn,
}) {
  let child;
  let stopping = false;
  let retryTimer;
  const server = createServer(async (request, response) => {
    const ready = request.url === "/ready";
    if (!ready && request.url !== "/health") {
      response.writeHead(404).end();
      return;
    }
    let available = Boolean(command && child && child.exitCode === null && !stopping);
    if (available && ready) available = await readyCheck();
    const status = ready ? (available ? 200 : 503) : 200;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        status: ready ? (available ? "ready" : startupError || "starting") : "ok",
      }),
    );
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });
  const launch = () => {
    if (stopping || !command) return;
    try {
      child = spawnProcess(command, args, { stdio: "inherit" });
    } catch (error) {
      console.error(error.message);
      retryTimer = setTimeout(launch, 5000);
      return;
    }
    child.once("error", (error) => console.error(error.message));
    child.once("close", (code, signal) => {
      child = undefined;
      if (!stopping) {
        console.error(`Child process exited (${signal ?? code}). Retrying in 5 seconds.`);
        retryTimer = setTimeout(launch, 5000);
      }
    });
  };
  launch();
  let shutdownPromise;
  const close = () => (shutdownPromise ??= shutdown());
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  async function shutdown() {
    stopping = true;
    clearTimeout(retryTimer);
    const runningChild = child;
    if (runningChild && runningChild.exitCode === null) {
      const exiting = new Promise((resolve) => runningChild.once("close", resolve));
      runningChild.kill("SIGTERM");
      await Promise.race([exiting, new Promise((resolve) => setTimeout(resolve, 5000))]);
      if (runningChild.exitCode === null) runningChild.kill("SIGKILL");
    }
    await new Promise((resolve) => server.close(resolve));
  }
  return { server, close };
}
