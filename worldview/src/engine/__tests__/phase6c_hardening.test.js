import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { CanonicalEvent } from '../event/CanonicalEvent.js';
import { RealWorldEvent } from '../event/RealWorldEvent.js';
import { EventType, SourceMode, CorroborationLevel, IncidentStatus, SeverityLevel } from '../event/types.js';
import { DataState } from '../providers/providerTypes.js';

import {
  EventCorrelator,
  IntelligenceEngine,
  EarthquakeCorrelationPolicy,
  CorrelationDecision,
  CORRELATION_POLICIES,
  globalExposureEngine,
} from '../intelligence/index.js';

import { IncidentManager } from '../incident/IncidentManager.js';
import { DataPipeline } from '../pipeline/DataPipeline.js';
import { scoreToSeverity, getSeverityFromScore, SEVERITY_THRESHOLDS } from '../risk/severityPolicy.js';
import { globalWorldPopService } from '../services/WorldPopService.js';
import { EarthquakeImpactEngine } from '../impact/EarthquakeImpactEngine.js';

describe('Phase 6C-H: Intelligence Correctness, Deduplication & Crisis Hardening', () => {
  let pipeline;
  let intelligence;
  let incidentMgr;

  beforeEach(() => {
    intelligence = new IntelligenceEngine();
    incidentMgr = new IncidentManager();
    pipeline = new DataPipeline({ intelligenceEngine: intelligence, incidentManager: incidentMgr });
  });

  // ── 1. DUPLICATE EARTHQUAKE & PROVENANCE PRESERVATION ───────────────────────
  it('1. Duplicate Earthquake: USGS Event A + GDACS Event B + USGS Revision C → 1 canonical event, 1 hypothesis, 1 incident', () => {
    const obsA = new CanonicalEvent({
      id: 'usgs_flores_75',
      source: 'USGS',
      providerId: 'USGS_SEISMIC',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T10:00:00Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0, name: 'Flores Sea' },
      payload: { magnitude: 7.5, depthKm: 12.0, place: 'Flores Sea, Indonesia' },
      sourceMode: SourceMode.LIVE,
    });

    const obsB = new CanonicalEvent({
      id: 'gdacs_flores_75',
      source: 'GDACS',
      providerId: 'GDACS_ALERT',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T10:03:00Z',
      location: { lat: -8.26, lon: 121.60, depthKm: 15.0, name: 'Flores Region' },
      payload: { magnitude: 7.5, depthKm: 15.0, place: 'Flores Region' },
      sourceMode: SourceMode.LIVE,
    });

    // Ingest initial observations
    pipeline.ingestCanonical([obsA, obsB]);

    let incidents = incidentMgr.getActive();
    assert.equal(incidents.length, 1, 'Initial USGS + GDACS must form exactly ONE active incident');
    assert.ok(incidents[0].evidence.length >= 2, 'Must preserve at least both USGS and GDACS as evidence');
    assert.ok(incidents[0].evidence.some((e) => e.source === 'USGS'), 'Must contain USGS evidence');
    assert.ok(incidents[0].evidence.some((e) => e.source === 'GDACS'), 'Must contain GDACS evidence');

    // Provider revision arrives for USGS
    const obsC = new CanonicalEvent({
      id: 'usgs_flores_75',
      source: 'USGS',
      providerId: 'USGS_SEISMIC',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T10:15:00Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0, name: 'Flores Sea' },
      payload: { magnitude: 7.7, depthKm: 12.0, place: 'Flores Sea, Indonesia (Reviewed)' },
      sourceMode: SourceMode.LIVE,
    });

    pipeline.ingestCanonical([obsC]);

    incidents = incidentMgr.getActive();
    assert.equal(incidents.length, 1, 'Provider revision must NOT create a second incident');
    assert.equal(incidents[0].severity, SeverityLevel.CRITICAL);
  });

  // ── 2. DUPLICATE PROCESSING IDEMPOTENCY ─────────────────────────────────────
  it('2. Duplicate Processing: Running intelligence evaluation twice produces 0 duplicate events/hypotheses/incidents', () => {
    const obs = new CanonicalEvent({
      id: 'usgs_quake_repeat',
      source: 'USGS',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T11:00:00Z',
      location: { lat: 35.71, lon: -117.51, depthKm: 8.0, name: 'Ridgecrest' },
      payload: { magnitude: 6.4, depthKm: 8.0, place: 'Ridgecrest, CA' },
      sourceMode: SourceMode.LIVE,
    });

    pipeline.ingestCanonical([obs]);
    const firstCount = incidentMgr.getAll().length;
    assert.equal(firstCount, 1);

    // Re-evaluate pipeline with the exact same event
    pipeline.evaluatePipeline();
    const secondCount = incidentMgr.getAll().length;
    assert.equal(secondCount, 1, 'Re-evaluating pipeline must be 100% idempotent');
  });

  // ── 3. PROVIDER REVISION IN-PLACE UPDATE ────────────────────────────────────
  it('3. Provider Revision: M7.5 → M7.7 updates canonical event in-place and preserves revision history', () => {
    const rwe = new RealWorldEvent({
      hazardType: 'EARTHQUAKE',
      canonicalLocation: { lat: -8.24, lon: 121.58, depthKm: 12.0, name: 'Flores Sea' },
      canonicalMagnitude: 7.5,
      sourceObservations: [
        { id: 'usgs_1', source: 'USGS', payload: { magnitude: 7.5 }, location: { lat: -8.24, lon: 121.58 } },
      ],
      sourceMode: SourceMode.LIVE,
    });

    const revisionObs = {
      id: 'usgs_1',
      source: 'USGS',
      payload: { magnitude: 7.7 },
      location: { lat: -8.25, lon: 121.59 },
      observedAt: '2026-08-20T10:30:00Z',
      sourceMode: SourceMode.LIVE,
    };

    rwe.addObservation(revisionObs);

    assert.equal(rwe.canonicalMagnitude, 7.7, 'Canonical magnitude must update to revised 7.7');
    assert.equal(rwe.revisionHistory.length, 1, 'Must record revision history entry');
    assert.equal(rwe.revisionHistory[0].previousMagnitude, 7.5);
    assert.equal(rwe.revisionHistory[0].newMagnitude, 7.7);
  });

  // ── 4. STRICT LIVE + SYNTHETIC ISOLATION ────────────────────────────────────
  it('4. Live + Synthetic Isolation: LIVE and SYNTHETIC observations NEVER merge (score = 0.0)', () => {
    const liveObs = new CanonicalEvent({
      id: 'live_quake_flores',
      source: 'USGS',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T12:00:00Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0, name: 'Flores Sea' },
      payload: { magnitude: 7.7, depthKm: 12.0 },
      sourceMode: SourceMode.LIVE,
    });

    const syntheticObs = new CanonicalEvent({
      id: 'sim_quake_flores_scenario',
      source: 'SEEDED_SCENARIO',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T12:00:00Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0, name: 'Flores Sea' },
      payload: { magnitude: 7.7, depthKm: 12.0 },
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
    });

    const policy = new EarthquakeCorrelationPolicy();
    const result = policy.evaluate(liveObs, syntheticObs);

    assert.equal(result.decision, CorrelationDecision.SEPARATE);
    assert.equal(result.score, 0.0);
    assert.match(result.rationale, /STRICT ISOLATION/);

    // Ingest both into correlator
    const correlator = new EventCorrelator();
    const clusters = correlator.correlate([liveObs, syntheticObs]);
    assert.equal(clusters.length, 2, 'Live and Synthetic must produce 2 isolated RealWorldEvents, never merged');
  });

  // ── 5. CORRELATION STATES (MATCHED, SEPARATE, AMBIGUOUS) ───────────────────
  it('5. Correlation States: Explicitly returns MATCHED, SEPARATE, and AMBIGUOUS without silent merging', () => {
    const policy = new EarthquakeCorrelationPolicy();

    const baseEvent = {
      location: { lat: 10.0, lon: 10.0, depthKm: 10 },
      observedAt: '2026-08-20T12:00:00Z',
      payload: { magnitude: 6.0 },
      sourceMode: SourceMode.LIVE,
    };

    // 1. High similarity -> MATCHED
    const matchedObs = {
      location: { lat: 10.05, lon: 10.05, depthKm: 12 },
      observedAt: '2026-08-20T12:05:00Z',
      payload: { magnitude: 6.1 },
      sourceMode: SourceMode.LIVE,
    };
    const matchRes = policy.evaluate(matchedObs, baseEvent);
    assert.equal(matchRes.decision, CorrelationDecision.MATCHED);
    assert.ok(matchRes.score >= 0.75);

    // 2. Far distance / time -> SEPARATE
    const separateObs = {
      location: { lat: 15.0, lon: 15.0, depthKm: 10 },
      observedAt: '2026-08-20T12:00:00Z',
      payload: { magnitude: 6.0 },
      sourceMode: SourceMode.LIVE,
    };
    const sepRes = policy.evaluate(separateObs, baseEvent);
    assert.equal(sepRes.decision, CorrelationDecision.SEPARATE);
    assert.ok(sepRes.score < 0.45);

    // 3. Marginal intermediate similarity -> AMBIGUOUS
    const ambiguousObs = {
      location: { lat: 10.20, lon: 10.20, depthKm: 25 },
      observedAt: '2026-08-20T12:10:00Z',
      payload: { magnitude: 5.7 },
      sourceMode: SourceMode.LIVE,
    };
    const ambRes = policy.evaluate(ambiguousObs, baseEvent);
    assert.equal(ambRes.decision, CorrelationDecision.AMBIGUOUS);
    assert.ok(ambRes.score >= 0.45 && ambRes.score < 0.75);
  });

  // ── 6. EXACT BOUNDARY TESTS ────────────────────────────────────────────────
  it('6. Boundary Tests: Spatial, temporal, and grid boundary conditions', () => {
    const policy = new EarthquakeCorrelationPolicy();

    const anchor = {
      location: { lat: 0.0, lon: 0.0, depthKm: 10 },
      observedAt: '2026-08-20T00:00:00Z',
      payload: { magnitude: 6.0 },
      sourceMode: SourceMode.LIVE,
    };

    // Close distance (20km) but distant time (48h) -> SEPARATE
    const distantTime = {
      location: { lat: 0.15, lon: 0.15, depthKm: 10 },
      observedAt: '2026-08-22T00:00:00Z',
      payload: { magnitude: 6.0 },
      sourceMode: SourceMode.LIVE,
    };
    assert.equal(policy.evaluate(distantTime, anchor).decision, CorrelationDecision.SEPARATE);

    // Close time (2min) but distant space (1500km) -> SEPARATE
    const distantSpace = {
      location: { lat: 13.5, lon: 0.0, depthKm: 10 },
      observedAt: '2026-08-20T00:02:00Z',
      payload: { magnitude: 6.0 },
      sourceMode: SourceMode.LIVE,
    };
    assert.equal(policy.evaluate(distantSpace, anchor).decision, CorrelationDecision.SEPARATE);

    // Provider revision with 30km spatial shift maintains MATCHED status
    const providerRevisionShift = {
      id: 'usgs_anchor_1',
      providerEventId: 'usgs_anchor_1',
      source: 'USGS',
      location: { lat: 0.25, lon: 0.15, depthKm: 15 },
      observedAt: '2026-08-20T00:10:00Z',
      payload: { magnitude: 6.1 },
      sourceMode: SourceMode.LIVE,
    };
    const anchorWithId = {
      ...anchor,
      id: 'usgs_anchor_1',
      providerEventId: 'usgs_anchor_1',
      source: 'USGS',
    };
    const revResult = policy.evaluate(providerRevisionShift, anchorWithId);
    assert.equal(revResult.decision, CorrelationDecision.MATCHED);
    assert.equal(revResult.breakdown.isExplicitProviderRevision, true);
  });

  // ── 7. POPULATION EXPOSURE: ZERO NEGATIVE VALUES ────────────────────────────
  it('7. Negative Population: Hard boundary validation rejects negative values and sets status UNAVAILABLE', () => {
    // Malformed/negative input to WorldPop service
    const expNegative = globalWorldPopService.calculateExposure({
      lat: -8.24,
      lon: 121.58,
      radiusKm: 50,
      options: { forceApproximation: true },
    });
    assert.ok(expNegative.estimatedPopulation >= 0, 'Population must never be negative');

    const engineExp = globalExposureEngine.evaluate({
      lat: NaN,
      lon: 121.58,
      radiusKm: 50,
    });
    assert.equal(engineExp.population.status, 'UNAVAILABLE');
    assert.equal(engineExp.population.estimatedPopulation, null);

    const impact = EarthquakeImpactEngine.evaluate({
      magnitude: 5.0,
      depthKm: 10,
      lat: 0.0,
      lon: 0.0,
    });
    assert.ok(impact.exposureMetrics.populationExposed >= 0, 'Impact populationExposed must be >= 0');
  });

  // ── 8. MISSING POPULATION HANDLING (OCEAN / REMOTE) ─────────────────────────
  it('8. Missing Population: Ocean/polar unmapped coordinates return status UNAVAILABLE and population null, never fake 0', () => {
    // Polar ice sheet coordinates outside continental grid
    const polarExp = globalWorldPopService.calculateExposure({
      lat: -75.0,
      lon: 0.0,
      radiusKm: 50,
    });

    assert.equal(polarExp.status, 'UNAVAILABLE');
    assert.equal(polarExp.estimatedPopulation, null, 'Must report null, never fake zero');
  });

  // ── 9. RISK SCORE 84/100 SEVERITY CLASSIFICATION ───────────────────────────
  it('9. Risk 84/100: Deterministically classified as CRITICAL via centralized severity policy', () => {
    assert.equal(scoreToSeverity(84), SeverityLevel.CRITICAL);
    assert.equal(getSeverityFromScore(84), SeverityLevel.CRITICAL);
    assert.equal(scoreToSeverity(75), SeverityLevel.HIGH);
    assert.equal(scoreToSeverity(45), SeverityLevel.MODERATE);
    assert.equal(scoreToSeverity(20), SeverityLevel.LOW);
    assert.equal(SEVERITY_THRESHOLDS.CRITICAL.minScore, 80);
  });

  // ── 10. EVIDENCE CONFLICT PRESERVATION (NO SILENT AVERAGING) ────────────────
  it('10. Evidence Conflict: Magnitude disagreement (USGS M7.7 vs GDACS M7.3) preserved without silent averaging', () => {
    const obsUSGS = new CanonicalEvent({
      id: 'usgs_conflict',
      source: 'USGS',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T14:00:00Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0 },
      payload: { magnitude: 7.7, depthKm: 12.0 },
      sourceMode: SourceMode.LIVE,
    });

    const obsGDACS = new CanonicalEvent({
      id: 'gdacs_conflict',
      source: 'GDACS',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T14:02:00Z',
      location: { lat: -8.25, lon: 121.59, depthKm: 14.0 },
      payload: { magnitude: 7.3, depthKm: 14.0 },
      sourceMode: SourceMode.LIVE,
    });

    const correlator = new EventCorrelator();
    const clusters = correlator.correlate([obsUSGS, obsGDACS]);

    assert.equal(clusters.length, 1, 'Must correlate into ONE real-world event');
    const cluster = clusters[0];
    assert.equal(cluster.corroborationLevel, CorroborationLevel.CONFLICTING_SOURCES);
    assert.equal(cluster.conflicts.length, 1);
    assert.equal(cluster.conflicts[0].field, 'magnitude');
    assert.equal(cluster.conflicts[0].difference, 0.4);
    assert.equal(cluster.canonicalMagnitude, 7.7, 'Primary magnitude preserved without averaging to 7.5');
  });

  // ── 11. FIRE CLUSTER AGGREGATION ───────────────────────────────────────────
  it('11. Fire Cluster: 10 proximate NASA FIRMS hotspots form ONE wildfire hypothesis; new hotspot updates cluster', () => {
    const hotspots = [];
    for (let i = 0; i < 10; i++) {
      hotspots.push(
        new CanonicalEvent({
          id: `firms_hotspot_${i}`,
          source: 'NASA_FIRMS',
          type: EventType.WILDFIRE_HOTSPOT,
          observedAt: new Date(Date.now() - i * 600000).toISOString(),
          location: { lat: 37.75 + i * 0.005, lon: -119.55 + i * 0.005 },
          payload: { frp: 25.0 + i * 5, brightnessTempK: 335.0 },
          sourceMode: SourceMode.LIVE,
        })
      );
    }

    pipeline.ingestCanonical(hotspots);
    let incidents = incidentMgr.getActive();
    assert.equal(incidents.length, 1, '10 proximate hotspots must form ONE wildfire incident, not 10 crises');
    assert.ok(incidents[0].evidence.length >= 10);

    // Add an 11th hotspot later
    const newHotspot = new CanonicalEvent({
      id: 'firms_hotspot_11',
      source: 'NASA_FIRMS',
      type: EventType.WILDFIRE_HOTSPOT,
      observedAt: new Date().toISOString(),
      location: { lat: 37.80, lon: -119.50 },
      payload: { frp: 45.0, brightnessTempK: 345.0 },
      sourceMode: SourceMode.LIVE,
    });

    pipeline.ingestCanonical([newHotspot]);
    incidents = incidentMgr.getActive();
    assert.equal(incidents.length, 1, 'New proximate hotspot must update the existing wildfire incident');
    assert.ok(incidents[0].evidence.length >= 11);
  });

  // ── 12. INCIDENT LIFECYCLE RESOLUTION ───────────────────────────────────────
  it('12. Resolved Event: Inactive incident cleanly transitions to RESOLVED without replacement incident', () => {
    const quake = new CanonicalEvent({
      id: 'usgs_quake_resolve',
      source: 'USGS',
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-20T16:00:00Z',
      location: { lat: 37.52, lon: 36.85, depthKm: 10.0, name: 'Anatolia' },
      payload: { magnitude: 6.8, depthKm: 10.0 },
      sourceMode: SourceMode.LIVE,
    });

    pipeline.ingestCanonical([quake]);
    let active = incidentMgr.getActive();
    assert.equal(active.length, 1);
    const incId = active[0].id;

    // Resolve the incident
    incidentMgr.resolve(incId, 'Post-disaster assessment complete; seismicity stabilized');
    const resolved = incidentMgr.get(incId);
    assert.equal(resolved.status, IncidentStatus.RESOLVED);
    assert.equal(incidentMgr.getActive().length, 0, 'No active incidents remain after resolution');
  });

  // ── 13. OBSERVABILITY REDUCTION METRICS ────────────────────────────────────
  it('13. Observability Reduction: Demonstrates bounded intelligence reduction metrics', () => {
    const events = [];
    // 20 raw events representing 2 physical clusters
    for (let i = 0; i < 10; i++) {
      events.push(
        new CanonicalEvent({
          id: `usgs_cluster1_${i}`,
          source: 'USGS',
          type: EventType.EARTHQUAKE,
          observedAt: new Date(Date.now() - i * 60000).toISOString(),
          location: { lat: -8.24 + i * 0.005, lon: 121.58 + i * 0.005, depthKm: 12.0 },
          payload: { magnitude: 7.7 },
          sourceMode: SourceMode.LIVE,
        })
      );
      events.push(
        new CanonicalEvent({
          id: `firms_cluster2_${i}`,
          source: 'NASA_FIRMS',
          type: EventType.WILDFIRE_HOTSPOT,
          observedAt: new Date(Date.now() - i * 60000).toISOString(),
          location: { lat: 37.75 + i * 0.005, lon: -119.55 + i * 0.005 },
          payload: { frp: 30.0 },
          sourceMode: SourceMode.LIVE,
        })
      );
    }

    const { metrics } = intelligence.evaluate(events);
    assert.equal(metrics.rawEvents, 20);
    assert.equal(metrics.eventClusters, 2, '20 raw events must reduce to 2 event clusters');
    assert.equal(metrics.uniqueRealWorldEvents, 2);
    assert.equal(metrics.duplicatesCollapsed, 18);
  });
});
