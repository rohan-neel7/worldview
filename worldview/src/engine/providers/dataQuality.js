/**
 * Worldview Data Fabric — Data Quality Score
 *
 * Normalized operational data-quality indicator with VISIBLE factor breakdown.
 *
 * IMPORTANT DOCUMENTATION:
 * This is an OPERATIONAL DATA-QUALITY INDICATOR, NOT a probability of truth.
 * It reflects how operationally reliable the data is based on measurable factors.
 * It is NOT a scientific certainty measure.
 *
 * The underlying factors are always available — the aggregate score is a convenience,
 * not the primary output.
 *
 * Design invariant: ProviderTier ≠ confidence.
 * Tier maps to a score range as an authority indicator, but is not the same as
 * observation-level confidence.
 */

import { ProviderTier, ProviderStatus } from './providerTypes.js';
import { FreshnessStatus } from '../event/types.js';

// ── Factor weights ───────────────────────────────────────────────────────────
const FACTOR_WEIGHTS = Object.freeze({
  freshness: 0.25,
  sourceTier: 0.25,
  completeness: 0.20,
  providerHealth: 0.15,
  coverage: 0.15,
});

// ── Tier score ranges (authority indicator, NOT confidence) ──────────────────
const TIER_SCORES = Object.freeze({
  [ProviderTier.TIER_A]: 95,
  [ProviderTier.TIER_B]: 80,
  [ProviderTier.TIER_C]: 60,
  [ProviderTier.TIER_D]: 40,
});

// ── Freshness score mapping ─────────────────────────────────────────────────
const FRESHNESS_SCORES = Object.freeze({
  [FreshnessStatus.LIVE]: 100,
  [FreshnessStatus.RECENT]: 80,
  [FreshnessStatus.STALE]: 40,
  [FreshnessStatus.EXPIRED]: 10,
  [FreshnessStatus.UNKNOWN]: 30,
});

// ── Provider health score mapping ────────────────────────────────────────────
const HEALTH_SCORES = Object.freeze({
  [ProviderStatus.HEALTHY]: 100,
  [ProviderStatus.STARTING]: 70,
  [ProviderStatus.DEGRADED]: 50,
  [ProviderStatus.STALE]: 30,
  [ProviderStatus.FAILED]: 5,
  [ProviderStatus.DISABLED]: 0,
  [ProviderStatus.UNKNOWN]: 40,
});

// ── Score to label mapping ──────────────────────────────────────────────────
function scoreToLabel(score) {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MODERATE';
  if (score >= 20) return 'LOW';
  return 'UNKNOWN';
}

/**
 * Computes a data quality assessment with visible factor breakdown.
 *
 * @param {object} params
 * @param {string} [params.freshness='UNKNOWN'] - FreshnessStatus enum value
 * @param {string} [params.tier='TIER_C'] - ProviderTier enum value
 * @param {number} [params.completeness=1.0] - 0.0 to 1.0, how complete the data fields are
 * @param {string} [params.providerHealth='UNKNOWN'] - ProviderStatus enum value
 * @param {number} [params.coverage=1.0] - 0.0 to 1.0, spatial coverage relevance
 * @returns {{ score: number, label: string, factors: Array<object> }}
 */
export function computeDataQuality({
  freshness = FreshnessStatus.UNKNOWN,
  tier = ProviderTier.TIER_C,
  completeness = 1.0,
  providerHealth = ProviderStatus.UNKNOWN,
  coverage = 1.0,
} = {}) {
  const factors = [];

  // 1. Freshness factor
  const freshnessScore = FRESHNESS_SCORES[freshness] ?? 30;
  factors.push({
    name: 'freshness',
    score: freshnessScore,
    weight: FACTOR_WEIGHTS.freshness,
  });

  // 2. Source tier factor (authority indicator, ≠ confidence)
  const tierScore = TIER_SCORES[tier] ?? 50;
  factors.push({
    name: 'sourceTier',
    score: tierScore,
    weight: FACTOR_WEIGHTS.sourceTier,
  });

  // 3. Completeness factor (proportion of expected data fields present)
  const completenessScore = Math.round(
    Math.max(0, Math.min(1, typeof completeness === 'number' ? completeness : 1.0)) * 100
  );
  factors.push({
    name: 'completeness',
    score: completenessScore,
    weight: FACTOR_WEIGHTS.completeness,
  });

  // 4. Provider health factor
  const healthScore = HEALTH_SCORES[providerHealth] ?? 40;
  factors.push({
    name: 'providerHealth',
    score: healthScore,
    weight: FACTOR_WEIGHTS.providerHealth,
  });

  // 5. Coverage relevance factor
  const coverageScore = Math.round(
    Math.max(0, Math.min(1, typeof coverage === 'number' ? coverage : 1.0)) * 100
  );
  factors.push({
    name: 'coverage',
    score: coverageScore,
    weight: FACTOR_WEIGHTS.coverage,
  });

  // Weighted aggregate
  let weightedSum = 0;
  let totalWeight = 0;
  for (const f of factors) {
    weightedSum += f.score * f.weight;
    totalWeight += f.weight;
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const label = scoreToLabel(score);

  return { score, label, factors };
}
