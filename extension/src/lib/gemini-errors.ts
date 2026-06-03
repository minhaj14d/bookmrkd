/** Google AI Studio / Gemini API rate limit and quota errors (HTTP 429, etc.). */

export const GEMINI_RATE_LIMIT_HINT =
  "Google AI Studio rate limit (429). Use Local (MiniLM) for tagging, or wait and retry. Free tier has low RPM.";

export function isGeminiRateLimitError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    msg.includes("429") ||
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("ratelimit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota exceeded") ||
    msg.includes("quota") ||
    msg.includes("overloaded")
  ) {
    return true;
  }
  return false;
}

export function geminiRateLimitError(status?: number, apiMessage?: string): Error {
  if (status === 429 || isGeminiRateLimitError(apiMessage || "")) {
    return new Error(GEMINI_RATE_LIMIT_HINT);
  }
  return new Error(apiMessage || `Gemini HTTP ${status ?? "error"}`);
}
