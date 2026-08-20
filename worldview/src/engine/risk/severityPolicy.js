/**
 * Worldview Disaster Intelligence — Centralized Severity & Risk Classification Policy
 *
 * Single source of truth for mapping numerical risk scores (0–100) to qualitative SeverityLevel.
 *
 * Adheres to Phase 6C-H Rules:
 *   - Centralized, immutable threshold definitions.
 *   - Single source of truth consumed across engine, hypothesis, incident, dossier, and UI.
 *   - Strict separation between:
 *       • riskScore (0–100)
 *       • crisisPriority (0–100)
 *       • assessmentConfidence (0.0–1.0)
 */

import { SeverityLevel } from '../event/types.js';

export const SEVERITY_THRESHOLDS = Object.freeze({
  CRITICAL: {
    minScore: 80,
    maxScore: 100,
    level: SeverityLevel.CRITICAL,
    label: 'CRITICAL',
    badgeClass: 'sev-badge-critical',
    colorHex: '#FF3333',
    rank: 4,
    description: 'Catastrophic or severe multi-vector disaster requiring emergency command mobilization.',
  },
  HIGH: {
    minScore: 60,
    maxScore: 79,
    level: SeverityLevel.HIGH,
    label: 'HIGH',
    badgeClass: 'sev-badge-high',
    colorHex: '#FF9900',
    rank: 3,
    description: 'Significant hazard impact with extensive population or infrastructure exposure.',
  },
  MODERATE: {
    minScore: 40,
    maxScore: 59,
    level: SeverityLevel.MODERATE,
    label: 'MODERATE',
    badgeClass: 'sev-badge-moderate',
    colorHex: '#FFD700',
    rank: 2,
    description: 'Localized or moderate severity hazard with contained asset exposure.',
  },
  LOW: {
    minScore: 0,
    maxScore: 39,
    level: SeverityLevel.LOW,
    label: 'LOW',
    badgeClass: 'sev-badge-low',
    colorHex: '#00FFFF',
    rank: 1,
    description: 'Minor or low-impact physical observation within nominal management thresholds.',
  },
});

/**
 * Deterministically maps a numerical risk score (0-100) to a SeverityLevel enum.
 *
 * @param {number|null|undefined} score
 * @returns {string} SeverityLevel (CRITICAL | HIGH | MODERATE | LOW)
 */
export function scoreToSeverity(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return SeverityLevel.MODERATE;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  if (clamped >= SEVERITY_THRESHOLDS.CRITICAL.minScore) {
    return SeverityLevel.CRITICAL;
  }
  if (clamped >= SEVERITY_THRESHOLDS.HIGH.minScore) {
    return SeverityLevel.HIGH;
  }
  if (clamped >= SEVERITY_THRESHOLDS.MODERATE.minScore) {
    return SeverityLevel.MODERATE;
  }
  return SeverityLevel.LOW;
}

/**
 * Alias for scoreToSeverity for clarity.
 */
export function getSeverityFromScore(score) {
  return scoreToSeverity(score);
}

/**
 * Returns metadata definition for a given SeverityLevel.
 *
 * @param {string} severity
 * @returns {object}
 */
export function getSeverityMetadata(severity) {
  const key = (severity || 'MODERATE').toUpperCase();
  return SEVERITY_THRESHOLDS[key] || SEVERITY_THRESHOLDS.MODERATE;
}
