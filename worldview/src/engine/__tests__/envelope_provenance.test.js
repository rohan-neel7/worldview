import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanonicalEvent,
  createHazardEvent,
  createEnvironmentalObservation,
  createMovingEntityEvent,
  createObservationEvent,
  validateCanonicalEvent,
  EventCategory,
  SourceMode,
  EventType,
} from '../index.js';

describe('Canonical Event Model & Provenance', () => {
  test('creates a valid common envelope with semantic payload', () => {
    const event = createHazardEvent({
      id: 'usgs:test-123',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      observedAt: '2026-08-19T12:00:00.000Z',
      receivedAt: '2026-08-19T12:00:02.000Z',
      location: { lat: 12.9716, lon: 77.5946, altMeters: 0, depthKm: 10 },
      confidence: 0.98,
      provenance: {
        providerEventId: 'test-123',
        providerEndpoint: '/earthquakes/feed.geojson',
        version: '1.0',
      },
      payload: {
        magnitude: 5.8,
        place: '10km NE of Bengaluru',
      },
    });

    assert.equal(event.id, 'usgs:test-123');
    assert.equal(event.source, 'USGS');
    assert.equal(event.sourceMode, SourceMode.LIVE);
    assert.equal(event.category, EventCategory.HAZARD);
    assert.equal(event.type, EventType.EARTHQUAKE);
    assert.equal(event.location.lat, 12.9716);
    assert.equal(event.location.lon, 77.5946);
    assert.equal(event.payload.magnitude, 5.8);

    // Provenance verification
    assert.ok(event.provenance);
    assert.equal(event.provenance.source, 'USGS');
    assert.equal(event.provenance.sourceMode, 'LIVE');
    assert.equal(event.provenance.providerEventId, 'test-123');
    assert.equal(event.provenance.providerEndpoint, '/earthquakes/feed.geojson');
    assert.ok(event.provenance.observedAt);
    assert.ok(event.provenance.receivedAt);
    assert.ok(event.provenance.processedAt);

    // Validation passes
    const validation = validateCanonicalEvent(event);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
  });

  test('validates semantic event categories', () => {
    const hazard = createHazardEvent({
      id: 'h-1',
      source: 'USGS',
      type: EventType.EARTHQUAKE,
      observedAt: new Date().toISOString(),
      location: { lat: 0, lon: 0 },
    });
    assert.equal(hazard.category, EventCategory.HAZARD);

    const env = createEnvironmentalObservation({
      id: 'e-1',
      source: 'Open-Meteo',
      type: EventType.WEATHER,
      observedAt: new Date().toISOString(),
      location: { lat: 10, lon: 20 },
      payload: { temperatureC: 24, windSpeedMps: 5 },
    });
    assert.equal(env.category, EventCategory.ENVIRONMENTAL);

    const moving = createMovingEntityEvent({
      id: 'm-1',
      source: 'OpenSky',
      type: EventType.AIRCRAFT,
      observedAt: new Date().toISOString(),
      location: { lat: 30, lon: -40, altMeters: 10500 },
      payload: { callsign: 'AIC101', speedMps: 230 },
    });
    assert.equal(moving.category, EventCategory.MOVING_ENTITY);

    const obs = createObservationEvent({
      id: 'o-1',
      source: 'WaterGaugeSensor',
      type: EventType.WATER_LEVEL_OBSERVATION,
      observedAt: new Date().toISOString(),
      location: { lat: 12.9, lon: 77.6 },
    });
    assert.equal(obs.category, EventCategory.OBSERVATION);
  });

  test('rejects invalid coordinates', () => {
    const invalidLat = createHazardEvent({
      id: 'bad-lat',
      source: 'TEST',
      type: EventType.EARTHQUAKE,
      observedAt: new Date().toISOString(),
      location: { lat: 95.0, lon: 0.0 }, // > 90
    });
    const res1 = validateCanonicalEvent(invalidLat);
    assert.equal(res1.valid, false);
    assert.ok(res1.errors.some((e) => e.includes('Latitude')));

    const invalidLon = createHazardEvent({
      id: 'bad-lon',
      source: 'TEST',
      type: EventType.EARTHQUAKE,
      observedAt: new Date().toISOString(),
      location: { lat: 0.0, lon: -195.0 }, // < -180
    });
    const res2 = validateCanonicalEvent(invalidLon);
    assert.equal(res2.valid, false);
    assert.ok(res2.errors.some((e) => e.includes('Longitude')));
  });

  test('rejects invalid timestamps and numeric NaN / Infinity', () => {
    const badNum = createHazardEvent({
      id: 'bad-num',
      source: 'TEST',
      type: EventType.EARTHQUAKE,
      observedAt: new Date().toISOString(),
      location: { lat: NaN, lon: 0 },
    });
    const res1 = validateCanonicalEvent(badNum);
    assert.equal(res1.valid, false);

    const badTimestamp = createHazardEvent({
      id: 'bad-time',
      source: 'TEST',
      type: EventType.EARTHQUAKE,
      observedAt: 'not-a-timestamp',
      location: { lat: 0, lon: 0 },
    });
    const res2 = validateCanonicalEvent(badTimestamp);
    assert.equal(res2.valid, false);
    assert.ok(res2.errors.some((e) => e.includes('observedAt')));
  });

  test('rejects provenance containing exposed secrets or API keys', () => {
    const eventWithSecret = createCanonicalEvent({
      id: 'leak-test',
      source: 'TEST',
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: new Date().toISOString(),
      location: { lat: 0, lon: 0 },
      provenance: {
        apiKey: 'secret_key_12345',
        bearer_token: 'xyz987',
      },
    });

    const validation = validateCanonicalEvent(eventWithSecret);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((e) => e.includes('sensitive credentials')));
  });
});
