/**
 * Worldview Data Fabric — Retry & Failure Policy
 *
 * Standard failure handling configuration for providers.
 * Returns delay values for the caller (ProviderManager) to schedule.
 * Does NOT create timers or perform retries itself.
 *
 * One broken provider must never block the entire Data Fabric.
 */

import { FailureType } from './providerTypes.js';

const DEFAULT_POLICY = Object.freeze({
  maxRetries: 3,
  backoffBaseMs: 1000,
  backoffMaxMs: 60000,
  jitterRatio: 0.2,        // 20% jitter
  rateLimitBackoffMs: 30000,
});

/**
 * Creates an immutable retry policy from configuration.
 *
 * @param {object} [config={}]
 * @returns {object} Frozen retry policy
 */
export function createRetryPolicy(config = {}) {
  return Object.freeze({
    maxRetries: config.maxRetries ?? DEFAULT_POLICY.maxRetries,
    backoffBaseMs: config.backoffBaseMs ?? DEFAULT_POLICY.backoffBaseMs,
    backoffMaxMs: config.backoffMaxMs ?? DEFAULT_POLICY.backoffMaxMs,
    jitterRatio: config.jitterRatio ?? DEFAULT_POLICY.jitterRatio,
    rateLimitBackoffMs: config.rateLimitBackoffMs ?? DEFAULT_POLICY.rateLimitBackoffMs,
  });
}

/**
 * Computes jitter for backoff delay.
 * @param {number} delayMs
 * @param {number} jitterRatio
 * @returns {number}
 */
function computeJitter(delayMs, jitterRatio) {
  const jitter = delayMs * jitterRatio;
  return Math.round(delayMs + (Math.random() * 2 - 1) * jitter);
}

/**
 * Determines whether a failed request should be retried and the delay before retrying.
 *
 * @param {string} failureType - FailureType enum value
 * @param {number} attemptCount - Number of attempts already made (0-based)
 * @param {object} [policy] - Retry policy (defaults to DEFAULT_POLICY)
 * @returns {{ retry: boolean, delayMs: number, reason: string }}
 */
export function shouldRetry(failureType, attemptCount, policy = DEFAULT_POLICY) {
  // Auth failures require human intervention — never retry
  if (failureType === FailureType.AUTH_FAILURE) {
    return { retry: false, delayMs: 0, reason: 'Authentication failure requires manual intervention' };
  }

  // Check if we've exceeded max retries
  if (attemptCount >= policy.maxRetries) {
    return { retry: false, delayMs: 0, reason: `Max retries (${policy.maxRetries}) exceeded` };
  }

  let baseDelay;
  let reason;

  switch (failureType) {
    case FailureType.RATE_LIMIT:
      // Extended backoff for rate limits
      baseDelay = policy.rateLimitBackoffMs * Math.pow(1.5, attemptCount);
      reason = 'Rate-limited — extended backoff';
      break;

    case FailureType.TIMEOUT:
      // Standard exponential backoff
      baseDelay = policy.backoffBaseMs * Math.pow(2, attemptCount);
      reason = 'Timeout — exponential backoff';
      break;

    case FailureType.TEMPORARY:
      // Standard exponential backoff
      baseDelay = policy.backoffBaseMs * Math.pow(2, attemptCount);
      reason = 'Temporary failure — exponential backoff';
      break;

    case FailureType.PROVIDER_UNAVAILABLE:
      // Longer initial wait, limited retries
      baseDelay = policy.backoffBaseMs * 4 * Math.pow(2, attemptCount);
      reason = 'Provider unavailable — extended backoff';
      break;

    case FailureType.MALFORMED_RESPONSE:
      // Brief retry in case of transient data corruption
      baseDelay = policy.backoffBaseMs * Math.pow(2, attemptCount);
      reason = 'Malformed response — retry with backoff';
      break;

    case FailureType.EMPTY_RESPONSE:
      // Brief retry — empty responses are often transient
      baseDelay = policy.backoffBaseMs * Math.pow(1.5, attemptCount);
      reason = 'Empty response — retry with backoff';
      break;

    default:
      baseDelay = policy.backoffBaseMs * Math.pow(2, attemptCount);
      reason = 'Unknown failure — standard backoff';
      break;
  }

  // Apply jitter and cap at maximum
  const delayWithJitter = computeJitter(baseDelay, policy.jitterRatio);
  const cappedDelay = Math.min(delayWithJitter, policy.backoffMaxMs);

  return {
    retry: true,
    delayMs: Math.max(0, Math.round(cappedDelay)),
    reason,
  };
}
