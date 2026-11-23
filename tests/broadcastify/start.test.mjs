import { expect, jest, test } from "@jest/globals";
import startBroadcastifyProcess from "../../src/broadcastify/start.mjs";

test("starts FFmpeg with piped input and error output", () => {
  const child = {};
  const spawnProcess = jest.fn(() => child);
  const settings = { host: "ice.example.org", port: 8000, mount: "/feed", password: "secret" };
  expect(startBroadcastifyProcess(settings, spawnProcess)).toBe(child);
  expect(spawnProcess).toHaveBeenCalledWith("ffmpeg", expect.any(Array), {
    stdio: ["pipe", "ignore", "pipe"],
  });
});
