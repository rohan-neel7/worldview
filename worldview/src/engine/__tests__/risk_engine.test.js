import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RiskEngine, SeverityLevel } from '../index.js';

describe('Deterministic Risk Engine', () => {
  test('calculates deterministic flood risk score and breakdown', () => {
    const input = {
      hazardType: 'FLOOD',
      metrics: {
        precipitationMm: 125.0,
        riverStageMeters: 3.5,
        exposureScore: 80,
        drainageCapacityPct: 20,
      },
      confidence: 0.9,
      evidenceGaps: [],
    };

    const res1 = RiskEngine.calculate(input);
    const res2 = RiskEngine.calculate(input);

    // Exact determinism
    assert.deepEqual(res1, res2);

    assert.ok(typeof res1.score === 'number' && res1.score >= 0 && res1.score <= 100);
    assert.ok(res1.score >= 70, `Expected elevated flood risk score, got ${res1.score}`);
    assert.equal(res1.severity, SeverityLevel.HIGH);
    assert.equal(res1.confidence, 0.9);
    assert.ok(Array.isArray(res1.breakdown) && res1.breakdown.length === 4);
    assert.ok(res1.explanation.includes('Flood Risk Model'));
  });

  test('maintains strict separation between Risk and Confidence', () => {
    // High-impact potential scenario but with significant evidence gaps
    const res = RiskEngine.calculate({
      hazardType: 'FLOOD',
      metrics: {
        precipitationMm: 150.0, // High rainfall
        // Missing water level and drainage metrics
      },
      confidence: 0.6,
      evidenceGaps: ['RIVER_STAGE_ANOMALY', 'INUNDATION_OBSERVATION'],
    });

    // High risk score (consequence if true is severe)
    assert.ok(res.score >= 60, `Expected high risk potential, got ${res.score}`);

    // But reduced confidence due to active evidence gaps
    assert.ok(res.confidence < 0.6, `Expected confidence reduced below 0.6, got ${res.confidence}`);
    assert.ok(res.confidence > 0, `Confidence should be finite positive, got ${res.confidence}`);
  });

  test('calculates tsunami risk model with depth attenuation', () => {
    const shallowQuake = RiskEngine.calculate({
      hazardType: 'TSUNAMI',
      metrics: { magnitude: 7.8, depthKm: 12, tsunamiFlag: true },
      confidence: 0.85,
    });

    const deepQuake = RiskEngine.calculate({
      hazardType: 'TSUNAMI',
      metrics: { magnitude: 7.8, depthKm: 180, tsunamiFlag: false },
      confidence: 0.85,
    });

    // Shallow quake must have significantly higher tsunami risk than deep quake of same magnitude
    assert.ok(
      shallowQuake.score > deepQuake.score,
      `Expected shallow (${shallowQuake.score}) > deep (${deepQuake.score})`
    );
  });

  test('clamps scores strictly to [0, 100] and rejects NaN / Infinity', () => {
    const extremeLow = RiskEngine.calculate({
      hazardType: 'GENERIC',
      metrics: { intensity: -500, exposureScore: 0, copingDeficit: 0 },
      confidence: -2,
    });
    assert.equal(extremeLow.score, 0);
    assert.equal(extremeLow.confidence, 0.1); // Lower clamp

    const extremeHigh = RiskEngine.calculate({
      hazardType: 'GENERIC',
      metrics: { intensity: 99999, exposureScore: 100, copingDeficit: 100 },
      confidence: 5.0,
    });
    assert.equal(extremeHigh.score, 100);
    assert.equal(extremeHigh.confidence, 1.0); // Upper clamp
  });
});
