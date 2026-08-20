import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceKm,
  temporalDiffMinutes,
  FloodPotentialRule,
  TsunamiHazardRule,
  WildfireRule,
  FusionEngine,
  createHazardEvent,
  createEnvironmentalObservation,
  createObservationEvent,
  EventType,
  SourceMode,
  IncidentStatus,
} from '../index.js';

describe('Data Fusion Engine & Rules', () => {
  test('computes accurate Haversine distances and temporal diffs', () => {
    // Distance between Bengaluru (12.9716, 77.5946) and Chennai (13.0827, 80.2707) is ~290 km
    const dist = haversineDistanceKm(12.9716, 77.5946, 13.0827, 80.2707);
    assert.ok(dist > 280 && dist < 300, `Expected ~290km, got ${dist}`);

    // Same point should be 0
    assert.equal(haversineDistanceKm(10, 20, 10, 20), 0);

    // Temporal diff in minutes
    const diff = temporalDiffMinutes('2026-08-19T12:00:00Z', '2026-08-19T12:45:00Z');
    assert.equal(diff, 45);
  });

  test('FloodPotentialRule: produces POTENTIAL FLOOD RISK with evidence gaps for rain-only signals', () => {
    const rule = new FloodPotentialRule();
    const rainOnly = [
      createEnvironmentalObservation({
        id: 'weather-01',
        source: 'Open-Meteo',
        type: EventType.WEATHER,
        observedAt: '2026-08-19T12:00:00.000Z',
        location: { lat: 12.97, lon: 77.59 },
        payload: { precipitationMm: 110.0 },
      }),
    ];

    const hypotheses = rule.evaluate(rainOnly);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.hazardType, 'FLOOD');
    assert.equal(hyp.status, IncidentStatus.DETECTED);
    assert.equal(hyp.confidence, 0.55); // Moderate confidence due to evidence gap
    assert.ok(hyp.evidenceGaps.includes('RIVER_STAGE_ANOMALY'));
    assert.equal(hyp.evidence.length, 1);
    assert.equal(hyp.evidence[0].eventId, 'weather-01');
  });

  test('FloodPotentialRule: correlates multi-sensor rain + gauge signals into ASSESSING status', () => {
    const rule = new FloodPotentialRule();
    const multiSensorEvents = [
      createEnvironmentalObservation({
        id: 'weather-01',
        source: 'Open-Meteo',
        type: EventType.WEATHER,
        observedAt: '2026-08-19T12:00:00.000Z',
        location: { lat: 12.97, lon: 77.59 },
        payload: { precipitationMm: 125.0 },
      }),
      createObservationEvent({
        id: 'water-gauge-02',
        source: 'WaterGaugeSensor',
        type: EventType.WATER_LEVEL_OBSERVATION,
        observedAt: '2026-08-19T12:10:00.000Z',
        location: { lat: 12.98, lon: 77.61 }, // ~2.5km away
        payload: { riverStageMeters: 4.2, waterLevelAnomaly: 2.5 },
      }),
    ];

    const hypotheses = rule.evaluate(multiSensorEvents);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.status, IncidentStatus.ASSESSING);
    assert.equal(hyp.confidence, 0.85); // Elevated confidence due to multi-source corroboration
    assert.equal(hyp.evidence.length, 2);
    assert.ok(!hyp.evidenceGaps.includes('RIVER_STAGE_ANOMALY'));
  });

  test('TsunamiHazardRule: produces POTENTIAL TSUNAMI HAZARD and never confirms without official warning', () => {
    const rule = new TsunamiHazardRule();

    // M7.2 shallow oceanic quake
    const quakes = [
      createHazardEvent({
        id: 'quake-01',
        source: 'USGS',
        type: EventType.EARTHQUAKE,
        observedAt: '2026-08-19T12:00:00.000Z',
        location: { lat: -8.5, lon: 115.5, depthKm: 15 },
        payload: { magnitude: 7.2, place: 'Bali Sea Epicenter', tsunamiFlag: 0 },
      }),
    ];

    const hypotheses = rule.evaluate(quakes);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.hazardType, 'TSUNAMI');
    assert.equal(hyp.status, IncidentStatus.DETECTED);
    assert.ok(hyp.title.includes('Potential Tsunami Hazard'));
    assert.ok(hyp.evidenceGaps.includes('OCEAN_BOTTOM_PRESSURE_ANOMALY'));
    assert.ok(hyp.evidenceGaps.includes('NATIONAL_TSUNAMI_WARNING'));
  });

  test('WildfireRule: rejects high wind alone without empirical thermal hotspot', () => {
    const rule = new WildfireRule();

    // High wind + high temp but NO thermal hotspot
    const windyDryWeather = [
      createEnvironmentalObservation({
        id: 'weather-windy',
        source: 'Open-Meteo',
        type: EventType.WEATHER,
        observedAt: '2026-08-19T12:00:00.000Z',
        location: { lat: 34.0, lon: -118.0 },
        payload: { windSpeedMps: 22.0, temperatureC: 38.0 },
      }),
    ];

    const hypotheses = rule.evaluate(windyDryWeather);
    // Crucial scientific rule: MUST NOT create wildfire hypothesis without hotspot
    assert.equal(hypotheses.length, 0);
  });

  test('WildfireRule: correlates simulated thermal hotspot with proximate wind telemetry', () => {
    const rule = new WildfireRule();

    const hotspotEvents = [
      createHazardEvent({
        id: 'sim-spot-01',
        source: 'SIMULATION_ENGINE',
        sourceMode: SourceMode.SIMULATED,
        type: EventType.WILDFIRE_HOTSPOT,
        observedAt: '2026-08-19T12:00:00.000Z',
        location: { lat: 34.05, lon: -118.25 },
        payload: { frp: 120, brightnessTempK: 380, place: 'Angeles Forest' },
      }),
      createEnvironmentalObservation({
        id: 'weather-local',
        source: 'Open-Meteo',
        type: EventType.WEATHER,
        observedAt: '2026-08-19T12:05:00.000Z',
        location: { lat: 34.08, lon: -118.22 }, // Proximate
        payload: { windSpeedMps: 15.0 },
      }),
    ];

    const hypotheses = rule.evaluate(hotspotEvents);
    assert.equal(hypotheses.length, 1);

    const hyp = hypotheses[0];
    assert.equal(hyp.hazardType, 'WILDFIRE');
    assert.equal(hyp.sourceMode, SourceMode.SIMULATED);
    assert.equal(hyp.evidence.length, 2);
    assert.equal(hyp.status, IncidentStatus.ASSESSING);
  });
});
