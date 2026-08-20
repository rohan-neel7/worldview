import { HAZARD_MODELS, scoreToSeverity } from './formulas.js';

export class RiskEngine {
  /**
   * Deterministically calculates risk assessment and transparent factor breakdown.
   *
   * @param {object} params
   * @param {string} [params.hazardType='GENERIC'] - 'FLOOD' | 'TSUNAMI' | 'WILDFIRE' | 'GENERIC'
   * @param {object} [params.metrics={}] - Observed measurements from evidence events
   * @param {number} [params.confidence=0.5] - Base evidence confidence
   * @param {Array<string>} [params.evidenceGaps=[]] - Missing evidence indicators
   * @returns {{ score: number, severity: string, confidence: number, breakdown: Array<object>, explanation: string }}
   */
  static calculate({
    hazardType = 'GENERIC',
    metrics = {},
    confidence = 0.5,
    evidenceGaps = [],
  }) {
    const model = HAZARD_MODELS[hazardType.toUpperCase()] || HAZARD_MODELS.GENERIC;
    const breakdown = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const factor of model.factors) {
      const res = factor.evaluate(metrics);
      const score = Math.max(0, Math.min(100, res.score));
      weightedSum += score * factor.weight;
      totalWeight += factor.weight;

      breakdown.push({
        factor: factor.name,
        weight: factor.weight,
        score,
        rawValue: res.raw,
        rationale: res.note,
      });
    }

    const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const clampedScore = Math.max(0, Math.min(100, finalScore));
    const severity = scoreToSeverity(clampedScore);

    // Calculate separated confidence score based on sensor confidence and evidence gaps
    let adjustedConfidence = Math.max(0.1, Math.min(1.0, confidence));
    if (evidenceGaps && evidenceGaps.length > 0) {
      // Scale down confidence for each unfulfilled evidence requirement (never zeroes, deterministic decay)
      const penalty = Math.min(0.35, evidenceGaps.length * 0.12);
      adjustedConfidence = Math.max(0.15, Number((adjustedConfidence - penalty).toFixed(2)));
    }

    // Build deterministic explanation text
    const topFactor = [...breakdown].sort((a, b) => b.score - a.score)[0];
    const explanation = `Evaluated risk score of ${clampedScore}/100 (${severity}) via ${model.name}. Dominant driver: ${topFactor?.factor || 'Hazard intensity'} (${topFactor?.rawValue || 'nominal'}). Confidence: ${Math.round(adjustedConfidence * 100)}%${evidenceGaps.length > 0 ? ` with ${evidenceGaps.length} active evidence gap(s).` : '.'}`;

    return {
      score: clampedScore,
      severity,
      confidence: adjustedConfidence,
      breakdown,
      explanation,
    };
  }
}
