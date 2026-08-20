/**
 * Worldview Data Fabric — Provider Health Tracking
 *
 * Mutable runtime operational state, COMPLETELY SEPARATE from immutable provider definitions.
 *
 * Design invariants:
 *   - Provider health (HEALTHY/DEGRADED/FAILED) ≠ data freshness (LIVE/RECENT/STALE/EXPIRED)
 *   - Both can vary independently:
 *     Provider HEALTHY + Data STALE = "API works but latest observation is old"
 *     Provider DEGRADED + Data RECENT = "Data arriving but provider unstable"
 *   - Error messages are sanitized to prevent secret leakage
 *   - Bounded metrics: max recent errors, rolling latency window
 *   - Does NOT trigger React state updates — snapshot-based reads only
 */

import { ProviderStatus, FailureType } from './providerTypes.js';
import { FreshnessStatus } from '../event/types.js';

const MAX_RECENT_ERRORS = 10;
const LATENCY_WINDOW_SIZE = 20;
const DEGRADED_THRESHOLD = 3;   // consecutive failures before DEGRADED
const FAILED_THRESHOLD = 7;     // consecutive failures before FAILED

/**
 * Sanitizes an error message to strip potential secrets.
 * Removes URL query parameters, auth headers, tokens, and long encoded strings.
 */
function sanitizeErrorMessage(msg) {
  if (typeof msg !== 'string') return 'Unknown error';
  // Strip URL query strings (may contain API keys)
  let sanitized = msg.replace(/\?[^\s]*/g, '?<REDACTED>');
  // Strip authorization header values
  sanitized = sanitized.replace(/(Authorization|Bearer|Token|api[_-]?key)\s*[:=]\s*\S+/gi, '$1: <REDACTED>');
  // Truncate excessively long messages
  if (sanitized.length > 200) {
    sanitized = sanitized.slice(0, 200) + '...';
  }
  return sanitized;
}

export class ProviderHealthTracker {
  constructor() {
    /** @type {Map<string, object>} */
    this.healthStates = new Map();
  }

  /**
   * Ensures a health state entry exists for a provider.
   * @param {string} providerId
   * @returns {object} Mutable health state
   */
  _ensureState(providerId) {
    if (!this.healthStates.has(providerId)) {
      this.healthStates.set(providerId, {
        status: ProviderStatus.UNKNOWN,
        lastSuccessfulRequest: null,
        lastAttempt: null,
        latencySamples: [],
        errorCount: 0,
        consecutiveFailures: 0,
        recentErrors: [],
        lastDataTime: null,
      });
    }
    return this.healthStates.get(providerId);
  }

  /**
   * Record a successful request for a provider.
   * Transitions to HEALTHY, resets consecutive failure count.
   *
   * @param {string} providerId
   * @param {number} [latencyMs=0]
   */
  recordSuccess(providerId, latencyMs = 0) {
    const state = this._ensureState(providerId);
    const now = new Date().toISOString();
    state.status = ProviderStatus.HEALTHY;
    state.lastSuccessfulRequest = now;
    state.lastAttempt = now;
    state.consecutiveFailures = 0;

    // Rolling latency window
    state.latencySamples.push(latencyMs);
    if (state.latencySamples.length > LATENCY_WINDOW_SIZE) {
      state.latencySamples.shift();
    }
  }

  /**
   * Record a failure for a provider.
   * Increments counters, transitions to DEGRADED/FAILED based on consecutive failures.
   *
   * @param {string} providerId
   * @param {string} failureType - FailureType enum value
   * @param {string} [errorMsg='']
   */
  recordFailure(providerId, failureType = FailureType.UNKNOWN, errorMsg = '') {
    const state = this._ensureState(providerId);
    const now = new Date().toISOString();
    state.lastAttempt = now;
    state.errorCount++;
    state.consecutiveFailures++;

    // Bounded recent errors
    state.recentErrors.push({
      type: failureType,
      message: sanitizeErrorMessage(errorMsg),
      at: now,
    });
    if (state.recentErrors.length > MAX_RECENT_ERRORS) {
      state.recentErrors.shift();
    }

    // Status transitions
    if (state.consecutiveFailures >= FAILED_THRESHOLD) {
      state.status = ProviderStatus.FAILED;
    } else if (state.consecutiveFailures >= DEGRADED_THRESHOLD) {
      state.status = ProviderStatus.DEGRADED;
    }
  }

  /**
   * Record that data was received from a provider.
   * Updates lastDataTime for freshness tracking.
   *
   * @param {string} providerId
   * @param {string|number|Date} [observedAt] - When the data was originally observed
   */
  recordDataReceived(providerId, observedAt = null) {
    const state = this._ensureState(providerId);
    state.lastDataTime = observedAt
      ? new Date(observedAt).toISOString()
      : new Date().toISOString();
  }

  /**
   * Get the health snapshot for a provider.
   * Returns a plain object (not a reference to internal state).
   *
   * @param {string} providerId
   * @returns {object} Health snapshot
   */
  getHealth(providerId) {
    const state = this._ensureState(providerId);
    const avgLatency = state.latencySamples.length > 0
      ? Math.round(state.latencySamples.reduce((a, b) => a + b, 0) / state.latencySamples.length)
      : null;

    const lastError = state.recentErrors.length > 0
      ? { ...state.recentErrors[state.recentErrors.length - 1] }
      : null;

    return {
      status: state.status,
      lastSuccessfulRequest: state.lastSuccessfulRequest,
      lastAttempt: state.lastAttempt,
      averageLatencyMs: avgLatency,
      errorCount: state.errorCount,
      consecutiveFailures: state.consecutiveFailures,
      lastError,
      lastDataTime: state.lastDataTime,
    };
  }

  /**
   * Derive data freshness status from lastDataTime vs expectedFreshnessMs.
   * Independent of provider health.
   *
   * @param {string} providerId
   * @param {number} expectedFreshnessMs - From provider definition
   * @param {number} [now=Date.now()] - Current epoch for deterministic evaluation
   * @returns {string} FreshnessStatus enum value
   */
  getDataFreshness(providerId, expectedFreshnessMs = 300000, now = Date.now()) {
    const state = this._ensureState(providerId);

    if (!state.lastDataTime) {
      return FreshnessStatus.UNKNOWN;
    }

    const lastDataEpoch = new Date(state.lastDataTime).getTime();
    if (isNaN(lastDataEpoch)) {
      return FreshnessStatus.UNKNOWN;
    }

    const ageMs = Math.max(0, now - lastDataEpoch);

    if (ageMs > expectedFreshnessMs * 5) return FreshnessStatus.EXPIRED;
    if (ageMs > expectedFreshnessMs * 2) return FreshnessStatus.STALE;
    if (ageMs > expectedFreshnessMs) return FreshnessStatus.RECENT;
    return FreshnessStatus.LIVE;
  }

  /**
   * Get the operational status for a provider.
   *
   * @param {string} providerId
   * @returns {string} ProviderStatus enum value
   */
  getStatus(providerId) {
    return this._ensureState(providerId).status;
  }

  /**
   * Reset health state for a provider.
   *
   * @param {string} providerId
   */
  reset(providerId) {
    this.healthStates.delete(providerId);
  }

  /**
   * Get a full snapshot of all provider health states.
   * Returns plain objects, safe for developer inspection.
   *
   * @returns {object} Map of providerId -> health snapshot
   */
  getSnapshot() {
    const snapshot = {};
    for (const [id] of this.healthStates) {
      snapshot[id] = this.getHealth(id);
    }
    return snapshot;
  }
}
