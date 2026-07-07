/**
 * fetch with bounded retry for transient failures.
 *
 * Retries on network errors, HTTP 429 and 5xx — the failure modes of the Expo
 * Push API worth retrying. 4xx (other than 429) are permanent and returned
 * immediately. Delays are injectable so tests run without real timers.
 */

export interface RetryOptions {
  attempts?: number; // total attempts including the first (default 3)
  baseDelayMs?: number; // first backoff delay (default 500, doubles each retry)
  sleep?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? defaultSleep;
  const fetchFn = options.fetchFn ?? fetch;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchFn(url, init);
      if (!isRetryableStatus(res.status)) return res;
      lastError = new Error(`HTTP ${res.status}`);
      // Drain the body so the connection can be reused
      await res.body?.cancel();
    } catch (err) {
      lastError = err;
    }

    if (attempt < attempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
