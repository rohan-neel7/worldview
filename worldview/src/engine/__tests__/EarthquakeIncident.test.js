import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EarthquakeImpactEngine } from '../impact/EarthquakeImpactEngine.js';
import { EarthquakeIncidentRule } from '../fusion/rules/EarthquakeIncidentRule.js';
import { createHazardEvent } from '../event/CanonicalEvent.js';
import { EventType, SourceMode } from '../event/types.js';
import { IncidentManager } from '../incident/IncidentManager.js';
import { HAZARD_MODELS } from '../risk/formulas.js';
import { RiskEngine } from '../risk/RiskEngine.js';

describe('Phase 3: Earthquake Impact Engine & Incident Command', () => {
  let impactEngine;
  let incidentRule;
  let incidentManager;

  beforeEach(() => {
    impactEngine = new EarthquakeImpactEngine();
    incidentRule = new EarthquakeIncidentRule();
    incidentManager = new IncidentManager();
  });

  describe('1. EarthquakeImpactEngine Isoseismals & Attenuation', () => {
    test('calculates deterministic shaking radii for M7.7 shallow earthquake', () => {
      const radii = impactEngine.calculateShakingRadii(7.7, 10);

      assert.ok(radii.severeRadiusKm > 30, `severe radius ${radii.severeRadiusKm} should be > 30km`);
      assert.ok(radii.moderateRadiusKm > radii.severeRadiusKm, 'moderate radius should exceed severe radius');
      assert.ok(radii.lightRadiusKm > radii.moderateRadiusKm, 'light radius should exceed moderate radius');
      assert.ok(radii.epicentralIntensityMMI >= 9.0, 'epicentral intensity should be >= IX');
    });

    test('demonstrates depth attenuation: deep quake has smaller surface shaking radii than shallow quake of same magnitude', () => {
      const shallowRadii = impactEngine.calculateShakingRadii(7.0, 10);
      const deepRadii = impactEngine.calculateShakingRadii(7.0, 180);

      assert.ok(shallowRadii.severeRadiusKm > deepRadii.severeRadiusKm, 'shallow severe radius should exceed deep');
      assert.ok(shallowRadii.moderateRadiusKm > deepRadii.moderateRadiusKm, 'shallow moderate radius should exceed deep');
      assert.ok(shallowRadii.epicentralIntensityMMI > deepRadii.epicentralIntensityMMI, 'shallow MMI should exceed deep MMI');
    });

    test('evaluates comprehensive impact for Flores / Ende M7.7 scenario', () => {
      const impact = impactEngine.evaluate({
        lat: -8.84,
        lon: 121.66,
        depthKm: 15,
        magnitude: 7.7,
        place: 'Ende, Flores, Indonesia',
      });

      assert.equal(impact.magnitude, 7.7);
      assert.ok(impact.shakingZones.severeRadiusKm > 30);
      assert.ok(impact.exposureMetrics.populationExposed > 0);
      assert.ok(impact.exposedAssets.hospitals.length > 0);
      assert.ok(impact.exposedAssets.airports.length > 0);

      // Verify secondary hazards
      assert.equal(impact.secondaryHazards.aftershock.status, 'CRITICAL');
      assert.ok(impact.secondaryHazards.aftershock.probability24hPct > 70);
      assert.match(impact.secondaryHazards.tsunami.status, /POTENTIAL|HIGH_RISK/);

      // Verify decision-support response options
      assert.ok(impact.responseOptions.length >= 3);
      assert.match(impact.responseOptions[0].priority, /CRITICAL|HIGH/);
    });
  });

  describe('2. Deterministic Earthquake Risk Model (HAZARD_MODELS.EARTHQUAKE)', () => {
    test('evaluates 5-factor weighted earthquake risk model', () => {
      const result = RiskEngine.calculate({
        hazardType: 'EARTHQUAKE',
        metrics: {
          magnitude: 7.5,
          depthKm: 12,
          populationExposed: 350000,
          hospitalsCount: 4,
          airportsCount: 2,
          portsCount: 1,
          exposureScore: 65,
          secondaryHazards: {
            aftershock: { status: 'HIGH' },
            tsunami: { status: 'MODERATE_POTENTIAL' },
            landslide: { status: 'HIGH' },
            infrastructureDisruption: { status: 'HIGH' },
          },
        },
        confidence: 0.95,
      });

      assert.ok(result.score >= 60 && result.score <= 100);
      assert.match(result.severity, /HIGH|CRITICAL/);
      assert.equal(result.breakdown.length, 5);
      assert.match(result.explanation, /M7.5/);
    });

    test('produces lower risk score for small deep earthquake', () => {
      const result = RiskEngine.calculate({
        hazardType: 'EARTHQUAKE',
        metrics: {
          magnitude: 4.5,
          depthKm: 120,
          populationExposed: 5000,
          hospitalsCount: 0,
          airportsCount: 0,
          portsCount: 0,
          exposureScore: 10,
          secondaryHazards: {
            aftershock: { status: 'LOW' },
            tsunami: { status: 'NONE' },
            landslide: { status: 'LOW' },
            infrastructureDisruption: { status: 'NOMINAL' },
          },
        },
        confidence: 0.85,
      });

      assert.ok(result.score < 50);
      assert.match(result.severity, /LOW|MODERATE/);
    });
  });

  describe('3. EarthquakeIncidentRule Fusion & Hypothesis Assembly', () => {
    test('correlates canonical USGS event with M >= 4.0 and generates hypothesis', () => {
      const canonicalEvent = createHazardEvent({
        id: 'usgs_nc75123456',
        source: 'USGS',
        type: EventType.EARTHQUAKE,
        sourceMode: SourceMode.LIVE,
        observedAt: new Date().toISOString(),
        location: { lat: 37.7749, lon: -122.4194, depthKm: 8 },
        confidence: 0.98,
        payload: {
          magnitude: 6.8,
          depthKm: 8,
          place: 'San Francisco Bay Area, CA',
          significance: 850,
        },
      });

      const matches = incidentRule.evaluate([canonicalEvent], []);
      assert.equal(matches.length, 1);

      const hyp = matches[0];
      assert.equal(hyp.hazardType, 'EARTHQUAKE');
      assert.match(hyp.title, /M6.8/);
      assert.ok(hyp.confidence >= 0.9);
      assert.ok(hyp.impactData);
      assert.ok(hyp.impactData.exposedAssets);
      assert.ok(hyp.evidence.length >= 1);
    });

    test('rejects micro-quakes with magnitude below threshold (< 4.0)', () => {
      const microEvent = createHazardEvent({
        id: 'usgs_nc11111',
        source: 'USGS',
        type: EventType.EARTHQUAKE,
        sourceMode: SourceMode.LIVE,
        observedAt: new Date().toISOString(),
        location: { lat: 35.0, lon: -118.0, depthKm: 5 },
        payload: {
          magnitude: 2.3,
          depthKm: 5,
        },
      });

      const matches = incidentRule.evaluate([microEvent], []);
      assert.equal(matches.length, 0);
    });
  });

  describe('4. End-to-End Incident Creation & Impact Preservation', () => {
    test('creates incident and preserves impactData through the pipeline', () => {
      const canonicalEvent = createHazardEvent({
        id: 'usgs_fl77001',
        source: 'USGS',
        type: EventType.EARTHQUAKE,
        sourceMode: SourceMode.LIVE,
        observedAt: new Date().toISOString(),
        location: { lat: -8.84, lon: 121.66, depthKm: 15 },
        confidence: 0.97,
        payload: {
          magnitude: 7.7,
          depthKm: 15,
          place: 'Ende, Flores, Indonesia',
        },
      });

      const hypotheses = incidentRule.evaluate([canonicalEvent], []);
      assert.equal(hypotheses.length, 1);

      const hypothesis = hypotheses[0];
      const incident = incidentManager.ingestHypothesis(hypothesis);

      assert.ok(incident);
      assert.ok(incident.impactData);
      assert.equal(incident.impactData.magnitude, 7.7);
      assert.ok(incident.impactData.shakingZones.moderateRadiusKm > 50);
      assert.ok(incident.impactData.exposedAssets.hospitals.length > 0);
      assert.ok(incident.evidenceGaps);
    });
  });
});
