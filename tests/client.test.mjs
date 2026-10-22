import { expect, jest, test } from "@jest/globals";
import { loadReadiness } from "../src/client.mjs";

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
