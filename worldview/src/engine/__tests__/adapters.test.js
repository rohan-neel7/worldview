import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  USGSAdapter,
  OpenSkyAdapter,
  CelesTrakAdapter,
  AISStreamAdapter,
  OpenMeteoAdapter,
  MilitaryAdsbAdapter,
  SimulationAdapter,
  EventCategory,
  EventType,
  SourceMode,
} from '../index.js';

describe('Provider Adapters', () => {
  test('USGSAdapter normalizes GeoJSON features into HazardEvents', () => {
    const adapter = new USGSAdapter();
    const rawGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          id: 'us7000abcd',
          properties: {
            mag: 6.2,
            place: '120km SSW of Banda Aceh, Indonesia',
            time: 1755600000000,
            status: 'reviewed',
            tsunami: 1,
            sig: 650,
          },
          geometry: {
            type: 'Point',
            coordinates: [95.3, 4.8, 15.0],
          },
        },
      ],
    };

    const result = adapter.safeNormalize(rawGeoJSON);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.HAZARD);
    assert.equal(ev.type, EventType.EARTHQUAKE);
    assert.equal(ev.location.lat, 4.8);
    assert.equal(ev.location.lon, 95.3);
    assert.equal(ev.location.depthKm, 15.0);
    assert.equal(ev.payload.magnitude, 6.2);
    assert.equal(ev.payload.tsunamiFlag, true);
    assert.equal(ev.provenance.providerEventId, 'us7000abcd');
  });

  test('OpenSkyAdapter normalizes state vectors into MovingEntityEvents', () => {
    const adapter = new OpenSkyAdapter();
    const rawStates = {
      time: 1755600000,
      states: [
        ['4b1812', 'SWR138  ', 'Switzerland', 1755600000, 1755600000, 8.54, 47.45, 11000, false, 240.5, 95.0, 0, null, 11200],
      ],
    };

    const result = adapter.safeNormalize(rawStates);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.MOVING_ENTITY);
    assert.equal(ev.type, EventType.AIRCRAFT);
    assert.equal(ev.location.lat, 47.45);
    assert.equal(ev.location.lon, 8.54);
    assert.equal(ev.payload.callsign, 'SWR138');
    assert.equal(ev.payload.speedMps, 240.5);
    assert.equal(ev.payload.military, false);
  });

  test('CelesTrakAdapter normalizes satellite position records', () => {
    const adapter = new CelesTrakAdapter();
    const rawSatellites = [
      {
        name: 'ISS (ZARYA)',
        noradId: '25544',
        lat: -12.4,
        lon: 130.8,
        alt: 420, // in km
        tle1: '1 25544U 98067A ...',
        tle2: '2 25544 ...',
      },
    ];

    const result = adapter.safeNormalize(rawSatellites);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.MOVING_ENTITY);
    assert.equal(ev.type, EventType.SATELLITE);
    assert.equal(ev.location.altMeters, 420000); // Converted to meters
    assert.equal(ev.payload.satName, 'ISS (ZARYA)');
  });

  test('AISStreamAdapter normalizes maritime vessels with knot-to-mps conversion', () => {
    const adapter = new AISStreamAdapter();
    const rawShips = {
      ships: [
        {
          mmsi: '211281610',
          name: 'EVER GIVEN',
          lat: 29.98,
          lon: 32.55,
          speed: 12.5, // in knots
          heading: 180,
          shipType: 'Cargo',
        },
      ],
    };

    const result = adapter.safeNormalize(rawShips);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.MOVING_ENTITY);
    assert.equal(ev.type, EventType.VESSEL);
    assert.equal(ev.payload.name, 'EVER GIVEN');
    assert.equal(ev.payload.speedKnots, 12.5);
    assert.ok(ev.payload.speedMps > 6.4 && ev.payload.speedMps < 6.5); // 12.5 * 0.514444 = ~6.43 m/s
  });

  test('OpenMeteoAdapter normalizes weather forecasts with kmh-to-mps conversion', () => {
    const adapter = new OpenMeteoAdapter();
    const rawWeather = {
      latitude: 12.97,
      longitude: 77.59,
      current_weather: {
        temperature: 26.4,
        windspeed: 18.0, // in km/h
        winddirection: 240,
        weathercode: 3,
        time: '2026-08-19T12:00',
        precipitation: 45.0,
      },
    };

    const result = adapter.safeNormalize(rawWeather);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.ENVIRONMENTAL);
    assert.equal(ev.type, EventType.WEATHER);
    assert.equal(ev.payload.temperatureC, 26.4);
    assert.equal(ev.payload.windSpeedMps, 5.0); // 18 km/h / 3.6 = 5.0 m/s
    assert.equal(ev.payload.precipitationMm, 45.0);
  });

  test('MilitaryAdsbAdapter normalizes military aircraft with military flag', () => {
    const adapter = new MilitaryAdsbAdapter();
    const rawMil = {
      ac: [
        {
          hex: 'ae0123',
          flight: 'RCH456  ',
          t: 'C17',
          lat: 34.5,
          lon: -118.2,
          alt_baro: 28000, // feet
          gs: 420, // knots
          track: 270,
        },
      ],
    };

    const result = adapter.safeNormalize(rawMil);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.MOVING_ENTITY);
    assert.equal(ev.type, EventType.AIRCRAFT);
    assert.equal(ev.payload.military, true);
    assert.equal(ev.payload.callsign, 'RCH456');
    assert.equal(ev.location.altMeters, 8534); // 28000 * 0.3048 = 8534.4m
  });

  test('SimulationAdapter strictly enforces sourceMode: SIMULATED', () => {
    const adapter = new SimulationAdapter();
    const simData = [
      {
        id: 'test-sim-01',
        type: EventType.FLOOD_SIGNAL,
        category: EventCategory.HAZARD,
        location: { lat: 12.97, lon: 77.59 },
        label: 'SIMULATED FLOOD SENSOR',
        sourceMode: 'LIVE', // Attempt to disguise as LIVE
      },
    ];

    const result = adapter.safeNormalize(simData);
    assert.equal(result.count, 1);
    const ev = result.events[0];

    // Crucial: Must be overwritten to SIMULATED
    assert.equal(ev.sourceMode, SourceMode.SIMULATED);
    assert.equal(ev.provenance.sourceMode, SourceMode.SIMULATED);
  });

  test('Gracefully degrades on empty, null, or malformed provider inputs', () => {
    const adapters = [
      new USGSAdapter(),
      new OpenSkyAdapter(),
      new CelesTrakAdapter(),
      new AISStreamAdapter(),
      new OpenMeteoAdapter(),
      new MilitaryAdsbAdapter(),
      new SimulationAdapter(),
    ];

    for (const a of adapters) {
      assert.deepEqual(a.safeNormalize(null), { events: [], error: null, count: 0 });
      assert.deepEqual(a.safeNormalize(undefined), { events: [], error: null, count: 0 });
      assert.deepEqual(a.safeNormalize([]), { events: [], error: null, count: 0 });
      assert.deepEqual(a.safeNormalize('malformed string'), { events: [], error: null, count: 0 });
    }
  });
});
