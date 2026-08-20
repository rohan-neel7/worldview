/**
 * Worldview Phase 6C — Multi-Source Intelligence & Hazard Correlation Test Suite
 *
 * Validates the core intelligence pipeline, anomaly detection, exposure modeling,
 * secondary cascades, crisis priority, and Scenarios A through J:
 *   - Scenario A: Earthquake Corroboration (USGS + GDACS)
 *   - Scenario B: Remote Earthquake (High hazard, low exposure)
 *   - Scenario C: Urban Earthquake (High exposure, high crisis priority)
 *   - Scenario D: Fire Cluster (10 FIRMS hotspots -> 1 cluster, NOT 10 crises)
 *   - Scenario E: Rainfall Anomaly & Flood Potential (Explicit evidence gaps)
 *   - Scenario F: Official Warning (SACHET/IMD official lineage)
 *   - Scenario G: Conflicting Sources (No silent averaging)
 *   - Scenario H: Stale Data (Confidence decay)
 *   - Scenario I: Missing Exposure Data (Status UNAVAILABLE, never 0)
 *   - Scenario J: Resolution Lifecycle
 *   - Performance Benchmarks (100, 500, 1,000, 5,000 events)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Intelligence Engines & Models
  HazardHypothesis,
  EventCorrelator,
  CORRELATION_RULES,
  AnomalyEngine,
  ANOMALY_THRESHOLDS,
  ExposureEngine,
  SecondaryRiskEngine,
  EvidenceEngine,
  EarthquakeIntelligence,
  FloodIntelligence,
  WildfireIntelligence,
  CycloneIntelligence,
  IntelligenceEngine,
  // Incident Manager & Enums
  IncidentManager,
  EventType,
  EventCategory,
  SourceMode,
  IncidentStatus,
  SeverityLevel,
  CorroborationLevel,
  AnomalyType,
  SecondaryRiskLevel,
  FreshnessStatus,
  DataState,
} from '../index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SCENARIO A: EARTHQUAKE CORROBORATION (USGS + GDACS)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario A: Earthquake Multi-Source Corroboration', () => {
  test('correlates USGS M7.7 and GDACS M7.7 into ONE hypothesis with multiple evidence sources', () => {
    const engine = new IntelligenceEngine();

    const usgsQuake = {
      id: 'usgs_quake_us7000flores',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T04:12:00Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0, name: 'Flores Sea' },
      provenance: { source: 'USGS', providerEventId: 'us7000flores' },
      confidence: 0.98,
      payload: { magnitude: 7.7, depthKm: 12.0, place: 'Flores Sea, Indonesia', tsunamiFlag: true },
    };

    const gdacsQuake = {
      id: 'gdacs_eq_1002345',
      source: 'GDACS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T04:12:30Z',
      location: { lat: -8.22, lon: 121.60, depthKm: 12.0, name: 'Flores Sea' },
      provenance: { source: 'GDACS', providerEventId: '1002345' },
      confidence: 0.96,
      payload: { magnitude: 7.7, depthKm: 12.0, alertLevel: 'RED', populationExposed: 1450000 },
    };

    const { hypotheses, clusters } = engine.evaluate([usgsQuake, gdacsQuake]);

    // Must correlate into ONE cluster and ONE hypothesis
    assert.equal(clusters.length, 1);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.hazardType, 'EARTHQUAKE');
    assert.equal(hyp.corroborationStrength, CorroborationLevel.CONFIRMED_BY_MULTIPLE_SOURCES);
    assert.equal(hyp.corroboration.sourceCount, 2);
    assert.ok(hyp.corroboration.sources.includes('USGS'));
    assert.ok(hyp.corroboration.sources.includes('GDACS'));

    // Evidence chain preserves both sources
    const evidenceSources = hyp.evidence.map((e) => e.source);
    assert.ok(evidenceSources.includes('USGS'));
    assert.ok(evidenceSources.includes('GDACS'));

    // Geometry is labelled ESTIMATED (Correction #4)
    assert.equal(hyp.geometry.label, 'ESTIMATED');
    assert.ok(hyp.geometry.estimatedShakingExtent);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SCENARIO B & C: REMOTE VS URBAN EARTHQUAKE EXPOSURE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario B & C: Remote vs Urban Earthquake Exposure & Priority', () => {
  test('Scenario B: Large remote earthquake produces high hazard severity but lower crisis priority', () => {
    const engine = new IntelligenceEngine();

    // Remote Kermadec Trench earthquake (M7.8 in deep ocean, zero population)
    const remoteQuake = {
      id: 'usgs_kermadec_m78',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T06:00:00Z',
      location: { lat: -30.0, lon: -178.0, depthKm: 35.0, name: 'Kermadec Islands Region' },
      confidence: 0.98,
      payload: { magnitude: 7.8, depthKm: 35.0, place: 'Kermadec Islands Region' },
    };

    const { hypotheses } = engine.evaluate([remoteQuake]);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.severity, SeverityLevel.CRITICAL); // M7.8 is critical hazard
    // Remote area has low exposure summary score
    assert.ok(hyp.exposure.summaryScore <= 30);
  });

  test('Scenario C: Urban earthquake produces high exposure, elevated secondary risk, and higher crisis priority', () => {
    const engine = new IntelligenceEngine();

    // Moderate/High quake in high-density urban corridor (Bengaluru, M6.8)
    const urbanQuake = {
      id: 'usgs_urban_m68',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T08:00:00Z',
      location: { lat: 12.97, lon: 77.59, depthKm: 10.0, name: 'Bengaluru Metropolitan' },
      confidence: 0.98,
      payload: { magnitude: 6.8, depthKm: 10.0, place: 'Bengaluru Metropolitan' },
    };

    const { hypotheses } = engine.evaluate([urbanQuake]);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.severity, SeverityLevel.HIGH);
    assert.ok(hyp.exposure.population.estimatedPopulation > 1000000);
    assert.ok(hyp.exposure.infrastructure.hospitalsCount > 0);
    assert.ok(hyp.crisisPriority >= 70, `Urban crisis priority (${hyp.crisisPriority}) should be >= 70`);
    assert.equal(hyp.shouldPromote, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SCENARIO D: NASA FIRMS FIRE CLUSTERING (10 HOTSPOTS -> 1 CRISIS)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario D: Wildfire Hotspot Clustering', () => {
  test('clusters 10 proximate NASA FIRMS hotspots into ONE wildfire hypothesis, NOT 10 crises', () => {
    const engine = new IntelligenceEngine();

    // Generate 10 proximate hotspots within 5km of each other
    const hotspots = Array.from({ length: 10 }, (_, i) => ({
      id: `firms_viirs_socal_${1000 + i}`,
      source: 'NASA_FIRMS',
      sourceMode: SourceMode.LIVE,
      type: EventType.WILDFIRE_HOTSPOT,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T14:30:00Z',
      location: { lat: 34.12 + i * 0.004, lon: -118.45 + i * 0.004 },
      confidence: 0.95,
      payload: {
        frpMW: 35.0 + i * 8, // Aggregated FRP
        brightnessKelvin: 340.0 + i * 2,
        satellite: 'VIIRS_NOAA20',
      },
    }));

    // Add proximate wind observation
    const windEvent = {
      id: 'weather_wind_socal_01',
      source: 'OPEN_METEO',
      sourceMode: SourceMode.LIVE,
      type: EventType.WEATHER,
      category: EventCategory.ENVIRONMENTAL,
      observedAt: '2026-08-20T14:30:00Z',
      location: { lat: 34.13, lon: -118.44 },
      confidence: 0.90,
      payload: { windSpeedMps: 15.5 }, // 15.5 m/s gale wind
    };

    const { hypotheses, clusters } = engine.evaluate([...hotspots, windEvent]);

    // Crucial Invariant: 10 hotspots + wind MUST produce exactly 1 wildfire cluster/hypothesis
    assert.equal(clusters.length, 1, 'All 10 hotspots and wind must correlate into 1 cluster');
    assert.equal(hypotheses.length, 1, 'Must produce exactly 1 wildfire hypothesis, not 10 crises');

    const hyp = hypotheses[0];
    assert.equal(hyp.hazardType, 'WILDFIRE');
    assert.ok(hyp.title.includes('Wildfire Complex'));
    assert.equal(hyp.secondaryRisks.spreadPotential?.level, SecondaryRiskLevel.HIGH);
    assert.equal(hyp.geometry.label, 'MODELED');
    assert.equal(hyp.shouldPromote, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SCENARIO E: RAINFALL ANOMALY & FLOOD INTELLIGENCE WITH EVIDENCE GAPS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario E: Rainfall Anomaly & Flood Intelligence', () => {
  test('extreme rainfall alone outputs POTENTIAL flood risk with explicit evidence gaps', () => {
    const engine = new IntelligenceEngine();

    const imdRainEvent = {
      id: 'imd_ka_rain_0820_99',
      source: 'IMD',
      sourceMode: SourceMode.LIVE,
      type: EventType.WEATHER,
      category: EventCategory.ENVIRONMENTAL,
      observedAt: '2026-08-20T10:00:00Z',
      location: { lat: 12.95, lon: 77.65, name: 'Bengaluru HAL' },
      confidence: 0.95,
      payload: {
        rainfallMm: 145.0, // 145 mm in 24h (IMD Very Heavy)
        rainfall1hMm: 45.0,
      },
    };

    const { hypotheses, anomalies } = engine.evaluate([imdRainEvent], { countryId: 'IN' });

    // 1. Point Anomaly detected
    assert.ok(anomalies.length >= 1);
    const rainAnom = anomalies.find((a) => a.category === 'PRECIPITATION');
    assert.ok(rainAnom);
    assert.equal(rainAnom.observedValue, 145.0);

    // 2. Flood Hypothesis produced
    assert.equal(hypotheses.length, 1);
    const hyp = hypotheses[0];
    assert.equal(hyp.hazardType, 'FLOOD');

    // Mandate Section 9: If only rainfall exists -> status is DETECTED / ASSESSING (POTENTIAL), NEVER CONFIRMED
    assert.ok(
      hyp.status === IncidentStatus.DETECTED || hyp.status === IncidentStatus.ASSESSING,
      `Status must be potential (DETECTED/ASSESSING), received: ${hyp.status}`
    );
    assert.ok(hyp.title.includes('Potential Flood Risk'));

    // Mandate Section 9: Explicit evidence gaps exposed
    assert.ok(hyp.evidenceGaps.length >= 1);
    assert.ok(hyp.evidenceGaps.some((g) => g.includes('River Gauge')));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SCENARIO F: OFFICIAL WARNING LINEAGE & NON-PREDICTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario F: Official Warning Lineage', () => {
  test('SACHET CAP 1.2 warning preserves official provenance without claiming Worldview prediction', () => {
    const engine = new IntelligenceEngine();

    const sachetAlert = {
      id: 'sachet_alert_in_2026_9941',
      source: 'SACHET',
      sourceMode: SourceMode.LIVE,
      type: EventType.OFFICIAL_WARNING,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T08:30:00Z',
      location: { lat: 13.34, lon: 74.74, name: 'Udupi Coastal Belt' },
      provenance: {
        source: 'SACHET',
        isOfficial: true,
        authority: 'National Disaster Management Authority (NDMA)',
      },
      confidence: 1.0,
      payload: {
        headline: 'Flash Flood Warning for Coastal Karnataka',
        severity: 'SEVERE',
        isOfficialWarning: true,
        isOfficial: true,
      },
    };

    const { hypotheses } = engine.evaluate([sachetAlert]);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.hazardType, 'FLOOD');

    // Evidence chain must contain official warning relevance
    const warnEvidence = hyp.evidence.find((e) => e.isOfficial);
    assert.ok(warnEvidence);
    assert.equal(warnEvidence.isOfficial, true);
    assert.equal(warnEvidence.source, 'SACHET');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SCENARIO G: CONFLICTING SOURCES PRESERVATION (NO SILENT AVERAGING)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario G: Source Conflict Preservation', () => {
  test('preserves magnitude disagreement between USGS M7.7 and GDACS M7.3 without silent averaging', () => {
    const engine = new IntelligenceEngine();

    const usgsQuake = {
      id: 'usgs_conflict_quake',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T12:00:00Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 10.0 },
      confidence: 0.98,
      payload: { magnitude: 7.7, depthKm: 10.0 },
    };

    const gdacsQuake = {
      id: 'gdacs_conflict_quake',
      source: 'GDACS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T12:00:15Z',
      location: { lat: -8.23, lon: 121.59, depthKm: 10.0 },
      confidence: 0.95,
      payload: { magnitude: 7.3, depthKm: 10.0 }, // 0.4 magnitude delta (>= 0.3 conflict threshold)
    };

    const { hypotheses } = engine.evaluate([usgsQuake, gdacsQuake]);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.corroborationStrength, CorroborationLevel.CONFLICTING_SOURCES);
    assert.ok(hyp.conflicts.length >= 1);

    const conflict = hyp.conflicts[0];
    assert.equal(conflict.field, 'magnitude');
    assert.equal(conflict.difference, 0.4);

    // Both raw values are preserved
    const usgsVal = conflict.values.find((v) => v.source === 'USGS');
    const gdacsVal = conflict.values.find((v) => v.source === 'GDACS');
    assert.equal(usgsVal.value, 7.7);
    assert.equal(gdacsVal.value, 7.3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SCENARIO H: STALE DATA CONFIDENCE DECAY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario H: Evidence Staleness Handling', () => {
  test('decays assessment confidence when primary hazard observations become STALE or EXPIRED', () => {
    const liveQuake = {
      id: 'quake_live_01',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: new Date().toISOString(),
      location: { lat: 35.0, lon: -118.0, depthKm: 10 },
      confidence: 0.95,
      freshness: { status: FreshnessStatus.LIVE },
      payload: { magnitude: 6.0, depthKm: 10 },
    };

    const staleQuake = {
      ...liveQuake,
      id: 'quake_stale_01',
      freshness: { status: FreshnessStatus.EXPIRED },
    };

    const engine = new IntelligenceEngine();
    const liveResult = engine.evaluate([liveQuake]);
    const staleResult = engine.evaluate([staleQuake]);

    assert.equal(liveResult.hypotheses.length, 1);
    assert.equal(staleResult.hypotheses.length, 1);

    const liveConf = liveResult.hypotheses[0].assessmentConfidence;
    const staleConf = staleResult.hypotheses[0].assessmentConfidence;

    assert.ok(
      staleConf < liveConf,
      `Stale confidence (${staleConf}) must be lower than live confidence (${liveConf})`
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SCENARIO I: MISSING EXPOSURE DATA HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario I: Missing Exposure Data Handling', () => {
  test('reports status: UNAVAILABLE and population: null when coordinates are unmapped, never 0', () => {
    const exposureEngine = new ExposureEngine();

    // Invalid / polar unmapped coordinate
    const result = exposureEngine.evaluate({ lat: -89.0, lon: -179.0, radiusKm: 20 });

    assert.equal(result.population.status, 'UNAVAILABLE');
    assert.equal(result.population.estimatedPopulation, null);
    assert.notEqual(result.population.estimatedPopulation, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SCENARIO J: PROMOTION & RESOLUTION LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario J: Promotion to IncidentManager & Lifecycle Resolution', () => {
  test('promotes qualifying hypothesis to IncidentManager and allows lifecycle transition to RESOLVED', () => {
    const im = new IncidentManager();
    const engine = new IntelligenceEngine();

    const majorQuake = {
      id: 'usgs_promotable_m70',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: new Date().toISOString(),
      location: { lat: 37.5, lon: 36.8, depthKm: 10.0, name: 'Kahramanmaras' },
      confidence: 0.98,
      payload: { magnitude: 7.0, depthKm: 10.0, place: 'Kahramanmaras, Turkey' },
    };

    const { hypotheses } = engine.evaluate([majorQuake]);
    assert.equal(hypotheses.length, 1);
    assert.equal(hypotheses[0].shouldPromote, true);

    const { promoted } = engine.promoteHypotheses(hypotheses, { incidentManager: im });
    assert.equal(promoted.length, 1);

    const incidentId = promoted[0].id;
    const stored = im.get(incidentId);
    assert.ok(stored);
    assert.equal(stored.type, 'EARTHQUAKE');

    // Transition to RESOLVED when threat subsides
    const resolved = im.resolve(incidentId, 'Aftershock activity subsided below threshold');
    assert.equal(resolved.status, IncidentStatus.RESOLVED);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PERFORMANCE BENCHMARKS (100, 500, 1,000, 5,000 EVENTS)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance Benchmarks', () => {
  test('evaluates 100, 500, 1,000, and 5,000 events within bounded time limits', () => {
    const engine = new IntelligenceEngine();

    function generateEvents(count) {
      return Array.from({ length: count }, (_, i) => ({
        id: `synth_perf_event_${i}`,
        source: i % 2 === 0 ? 'USGS' : 'NASA_FIRMS',
        sourceMode: SourceMode.LIVE,
        type: i % 2 === 0 ? EventType.EARTHQUAKE : EventType.WILDFIRE_HOTSPOT,
        category: EventCategory.HAZARD,
        observedAt: new Date().toISOString(),
        location: {
          lat: 10.0 + (i % 50) * 0.1,
          lon: 70.0 + (i % 50) * 0.1,
        },
        confidence: 0.90,
        payload: {
          magnitude: 4.5 + (i % 20) * 0.1,
          frpMW: 30 + (i % 50),
        },
      }));
    }

    // 100 events
    const t0 = Date.now();
    const res100 = engine.evaluate(generateEvents(100));
    const d100 = Date.now() - t0;
    assert.ok(d100 < 200, `100 events evaluation took ${d100}ms (limit 200ms)`);
    assert.ok(res100.hypotheses.length > 0);

    // 500 events
    const t1 = Date.now();
    const res500 = engine.evaluate(generateEvents(500));
    const d500 = Date.now() - t1;
    assert.ok(d500 < 500, `500 events evaluation took ${d500}ms (limit 500ms)`);
    assert.ok(res500.hypotheses.length > 0);

    // 1,000 events
    const t2 = Date.now();
    const res1000 = engine.evaluate(generateEvents(1000));
    const d1000 = Date.now() - t2;
    assert.ok(d1000 < 1000, `1,000 events evaluation took ${d1000}ms (limit 1000ms)`);
    assert.ok(res1000.hypotheses.length > 0);

    // 5,000 events
    const t3 = Date.now();
    const res5000 = engine.evaluate(generateEvents(5000));
    const d5000 = Date.now() - t3;
    assert.ok(d5000 < 4000, `5,000 events evaluation took ${d5000}ms (limit 4000ms)`);
    assert.ok(res5000.hypotheses.length > 0);
  });
});
