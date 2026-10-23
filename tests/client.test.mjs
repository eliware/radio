import { expect, jest, test } from "@jest/globals";
import { bindAudioStatus, loadChannelStatus, loadReadiness } from "../src/client.mjs";

function createDocument() {
  const statusElement = { textContent: "Checking" };
  return { documentObject: { querySelector: jest.fn(() => statusElement) }, statusElement };
}

test("shows ready when the server reports readiness", async () => {
  const { documentObject, statusElement } = createDocument();
  await loadReadiness(
    jest.fn(async () => ({ ok: true })),
    documentObject,
  );
  expect(statusElement.textContent).toBe("Ready");
});

test("shows unavailable when the server is not ready or cannot be reached", async () => {
  const { documentObject, statusElement } = createDocument();
  await loadReadiness(
    jest.fn(async () => ({ ok: false })),
    documentObject,
  );
  expect(statusElement.textContent).toBe("Unavailable");

  await loadReadiness(
    jest.fn(async () => Promise.reject(new Error("offline"))),
    documentObject,
  );
  expect(statusElement.textContent).toBe("Unavailable");
});

test("does nothing when the page has no status element", async () => {
  const documentObject = { querySelector: jest.fn(() => null) };
  const fetcher = jest.fn();
  await loadReadiness(fetcher, documentObject);
  expect(fetcher).not.toHaveBeenCalled();
});

test("shows receiver state and stream errors for each channel", async () => {
  const statuses = {
    police: { textContent: "", dataset: {} },
    fire: { textContent: "", dataset: {} },
  };
  const documentObject = {
    querySelector: (selector) => statuses[selector.slice(1, -7)] ?? null,
  };
  await loadChannelStatus(
    async () => ({
      ok: true,
      json: async () => ({
        police: { state: "running" },
        fire: { state: "disconnected" },
      }),
    }),
    documentObject,
  );
  expect(statuses.police.textContent).toContain("Receiver ready");
  expect(statuses.fire.textContent).toContain("Reconnect");
  expect(statuses.police.dataset.receiverState).toBe("running");
  await loadChannelStatus(
    async () => ({ ok: true, json: async () => ({ fire: { state: "error" } }) }),
    documentObject,
  );
  expect(statuses.fire.textContent).toContain("check service logs");
  await loadChannelStatus(async () => ({ ok: false }), documentObject);
  expect(statuses.police.textContent).toContain("unavailable");
  await loadChannelStatus(async () => {
    throw new Error("offline");
  }, documentObject);
  expect(statuses.fire.dataset.receiverState).toBe("unavailable");
  await loadChannelStatus(jest.fn(), { querySelector: () => null });
  await loadChannelStatus(async () => ({ ok: true, json: async () => ({}) }), {
    querySelector: (selector) => (selector === "#police-status" ? statuses.police : null),
  });
});

test("binds live audio events to useful channel messages", () => {
  const elements = {};
  for (const channel of ["police", "fire"]) {
    elements[`${channel}-audio`] = {
      addEventListener: jest.fn((name, callback) => {
        elements[`${channel}-${name}`] = callback;
      }),
    };
    elements[`${channel}-status`] = { textContent: "Ready" };
  }
  bindAudioStatus({ querySelector: (selector) => elements[selector.slice(1)] });
  elements["police-playing"]();
  expect(elements["police-status"].textContent).toContain("Playing live audio");
  elements["fire-waiting"]();
  expect(elements["fire-status"].textContent).toContain("Connecting");
  elements["fire-error"]();
  expect(elements["fire-status"].textContent).toContain("unavailable");
  bindAudioStatus({ querySelector: () => null });
});
