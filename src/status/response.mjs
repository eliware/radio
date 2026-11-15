import { redactErrorText } from "../logging/error-details.mjs";

export function createStatusResponse(route, ready, status) {
  return {
    statusCode: route === "/ready" && !ready ? 503 : 200,
    headers: { "content-type": "application/json" },
    body: redactErrorText(
      JSON.stringify({
        status: route === "/health" ? "ok" : ready ? "ready" : "not-ready",
        ...status,
      }),
    ),
  };
}
