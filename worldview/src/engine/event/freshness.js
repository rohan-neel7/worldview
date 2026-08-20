import { FreshnessStatus } from './types.js';

/**
 * Computes deterministic freshness metadata for an event.
 *
 * @param {string|number|Date} observedAt - Timestamp when the phenomenon was observed
 * @param {string|number|Date} receivedAt - Timestamp when Worldview received the data
 * @param {number} [maxAgeMs=300000] - Base freshness threshold in ms (default 5 min)
 * @param {number} [now=Date.now()] - Current epoch timestamp for deterministic evaluation
 * @returns {{ observedAt: string, receivedAt: string, maxAgeMs: number, ageMs: number, status: string }}
 */
export function computeFreshness(observedAt, receivedAt, maxAgeMs = 300000, now = Date.now()) {
  const normReceivedAt = receivedAt ? new Date(receivedAt).toISOString() : new Date(now).toISOString();

  if (!observedAt) {
    return {
      observedAt: null,
      receivedAt: normReceivedAt,
      maxAgeMs,
      ageMs: null,
      status: FreshnessStatus.UNKNOWN,
    };
  }

  const observedEpoch = new Date(observedAt).getTime();
  if (isNaN(observedEpoch)) {
    return {
      observedAt: String(observedAt),
      receivedAt: normReceivedAt,
      maxAgeMs,
      ageMs: null,
      status: FreshnessStatus.UNKNOWN,
    };
  }

  const ageMs = Math.max(0, now - observedEpoch);
  let status = FreshnessStatus.LIVE;

  if (ageMs > maxAgeMs * 5) {
    status = FreshnessStatus.EXPIRED;
  } else if (ageMs > maxAgeMs * 2) {
    status = FreshnessStatus.STALE;
  } else if (ageMs > maxAgeMs) {
    status = FreshnessStatus.RECENT;
  } else {
    status = FreshnessStatus.LIVE;
  }

  return {
    observedAt: new Date(observedEpoch).toISOString(),
    receivedAt: normReceivedAt,
    maxAgeMs,
    ageMs,
    status,
  };
}
