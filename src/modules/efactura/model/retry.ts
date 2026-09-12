/// Retry policy for talking to SIA "e-Factura".
///
/// Pure and testable — the queue plugs the schedule in and observes what it
/// returns. Not every failure gets a retry: a rejected document is not
/// re-submitted, only a transport problem is. That decision lives in the error
/// catalogue and reaches here as `retryable`.
///
/// Backoff is exponential with jitter, so a wave of documents queued for the
/// same failure does not hit the platform in lockstep the moment it recovers.

export interface RetryStep {
  attempt: number;
  delayMs: number;
  isFinal: boolean;
}

export interface RetryPolicy {
  /// Maximum number of attempts including the first. Six attempts over roughly
  /// two hours covers a normal outage without spinning the retry queue forever.
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 6,
  baseDelayMs: 30_000,
  maxDelayMs: 30 * 60_000,
};

export function nextRetry(
  attempt: number,
  random: () => number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): RetryStep {
  const capped = Math.min(policy.maxAttempts, Math.max(1, attempt));
  const exponent = Math.min(capped, 10);
  const raw = policy.baseDelayMs * 2 ** (exponent - 1);
  const capReached = Math.min(raw, policy.maxDelayMs);
  // Full jitter, per AWS's own recommendation: uniform between 0 and the
  // computed delay. Half-jitter would still synchronise partially.
  const jittered = Math.floor(random() * capReached);

  return {
    attempt: capped,
    delayMs: jittered,
    isFinal: capped >= policy.maxAttempts,
  };
}

export function shouldRetry(retryable: boolean, attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  return retryable && attempt < policy.maxAttempts;
}
