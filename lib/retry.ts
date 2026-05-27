function getDelayMs(err: unknown, baseDelayMs: number, attempt: number): number | null {
  const message = err instanceof Error ? err.message : String(err);

  // Extract HTTP status from error message (e.g. "[429 RESOURCE_EXHAUSTED]")
  const statusMatch = message.match(/\b([45]\d{2})\b/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : null;

  // Don't retry on 4xx client errors — except 429
  if (status && status >= 400 && status < 500 && status !== 429) {
    return null;
  }

  // 429 rate limit: 15s minimum, honour retry-after if present
  if (status === 429 || /rate.?limit|quota.?exceeded|resource.?exhausted/i.test(message)) {
    const retryAfterMatch = message.match(/retry.?after[:\s]+(\d+)/i);
    const retryAfterMs = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) * 1000 : 0;
    return Math.max(15000, retryAfterMs);
  }

  // 5xx, network errors, parse errors, empty-response errors → exponential backoff
  return baseDelayMs * Math.pow(2, attempt - 1);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) break;

      const delayMs = getDelayMs(err, baseDelayMs, attempt);
      if (delayMs === null) throw err; // non-retryable (4xx other than 429)

      const message = err instanceof Error ? err.message : String(err);
      console.log(
        `[withRetry] Attempt ${attempt}/${maxAttempts} failed: ${message}. Retrying in ${delayMs}ms…`
      );
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError;
}
