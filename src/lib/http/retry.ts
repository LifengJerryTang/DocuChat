import { AxiosError } from 'axios';

function isRetryable(error: AxiosError): boolean {
  // No response = network error or timeout. Always retry.
  if (!error.response) return true;

  const status = error.response.status;
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = options;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!(error instanceof AxiosError) || !isRetryable(error)) {
        throw error; // permanent failure — don't retry
      }

      if (attempt === maxAttempts) {
        throw error; // exhausted retries
      }

      // Honor Retry-After if present, otherwise exponential backoff
      const retryAfter = (error as AxiosError).response?.headers['retry-after'];
      const delayMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : baseDelayMs * Math.pow(2, attempt - 1);

      console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms:`, (error as AxiosError).message);
      await delay(delayMs);
    }
  }

  throw lastError;
}
