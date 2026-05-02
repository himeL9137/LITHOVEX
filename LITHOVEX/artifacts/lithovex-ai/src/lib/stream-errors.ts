// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Stream Error Classification
// Prompt 3 / Layer 5: Production-grade error taxonomy with recovery hints.
// ─────────────────────────────────────────────────────────────────────────────

export type StreamErrorCode =
  | "NETWORK_ERROR"
  | "RATE_LIMIT"
  | "CONTEXT_LENGTH"
  | "AUTH_ERROR"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "ABORTED";

export class StreamError extends Error {
  constructor(
    message: string,
    public readonly code: StreamErrorCode,
    public readonly recoverable: boolean,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "StreamError";
  }
}

/**
 * Convert any thrown value or HTTP response into a structured StreamError.
 * The classifier inspects HTTP status codes, AbortError names, and message
 * text to assign the correct code and recoverability flag.
 */
export function classifyStreamError(error: unknown, response?: Response): StreamError {
  if (error instanceof StreamError) return error;

  const err = error as { name?: string; message?: string };

  if (err?.name === "AbortError") {
    return new StreamError("Stream cancelled by user", "ABORTED", false);
  }

  if (err?.name === "TimeoutError") {
    return new StreamError("Stream timed out", "TIMEOUT", true);
  }

  if (err?.name === "TypeError" && err?.message?.includes("fetch")) {
    return new StreamError("Network connection failed", "NETWORK_ERROR", true);
  }

  if (response) {
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      return new StreamError("Rate limit exceeded", "RATE_LIMIT", true, retryAfter);
    }
    if (response.status === 413 || response.status === 400) {
      return new StreamError(
        "Context length exceeded or invalid request",
        "CONTEXT_LENGTH",
        false
      );
    }
    if (response.status === 401 || response.status === 403) {
      return new StreamError("Authentication failed", "AUTH_ERROR", false);
    }
    if (response.status >= 500) {
      return new StreamError(
        `Provider returned ${response.status}`,
        "PROVIDER_ERROR",
        true
      );
    }
  }

  return new StreamError(
    err?.message ?? "Unknown streaming error",
    "PROVIDER_ERROR",
    true
  );
}
