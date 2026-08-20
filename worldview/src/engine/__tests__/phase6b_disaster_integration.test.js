/**
 * Worldview Phase 6B — High-Value Disaster Data Integration Tests
 *
 * Validates all six provider integrations, adapters, services, provenance,
 * failure isolation, and Scenarios A through F:
 *   - Step 1: IMD (Weather Observations, District Warnings, Cyclone Tracks)
 *   - Step 2: SACHET (NDMA CAP 1.2 Official Alert System)
 *   - Step 3: GDACS (Multi-Hazard & Scenario A Earthquake Corroboration)
 *   - Step 4: NASA FIRMS (VIIRS/MODIS & Scenario B Fire Observations)
 *   - Step 5: WorldPop (Scenario E Population Exposure Baseline)
 *   - Step 6: Copernicus DEM (Scenario F Elevation Baseline & Derived Slope)
 *   - End-to-End Pipeline & Capability Matrix
 *   - Failure Isolation & Non-Interference
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Adapters
  IMDWeatherAdapter,
  IMDWarningAdapter,
  IMDCycloneAdapter,
  SACHETAdapter,
  GDACSAdapter,
  FIRMSAdapter,
} from '../adapters/index.js';

import {
  // Baseline Services
  WorldPopService,
  CopernicusDEMService,
  // Data Fabric & Registry Singletons
  globalProviderRegistry,
  globalProviderHealthTracker,
  globalDataFabric,
  globalCapabilityRegistry,
  // Enums
  ProviderTier,
  ProviderClass,
  CapabilityStatus,
  ProviderStatus,
  DataState,
} from '../providers/index.js';

import { EventCategory, EventType, SourceMode } from '../event/types.js';
import { DataPipeline } from '../pipeline/DataPipeline.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STEP 1: IMD (INDIA METEOROLOGICAL DEPARTMENT) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Step 1: IMD Multi-Product Adapters', () => {
  test('IMDWeatherAdapter normalizes station observations and converts wind speed', () => {
    const adapter = new IMDWeatherAdapter();
    const rawData = {
      stations: [
        {
          station_id: '43295',
          station_name: 'Bengaluru / HAL Airport',
          latitude: 12.95,
          longitude: 77.67,
          altitude_m: 888,
          temperature: 24.5,
          rh: 78,
          pressure_hpa: 1012.4,
          wind_speed_kmh: 18.0, // 18 km/h = 5.0 m/s
          wind_direction: 260,
          rainfall_24h_mm: 45.2,
          rainfall_1h_mm: 12.0,
          weather_desc: 'Heavy Rain / Thunderstorm',
          timestamp: '2026-08-20T10:00:00Z',
        },
      ],
    };

    const result = adapter.safeNormalize(rawData);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.source, 'IMD');
    assert.equal(ev.category, EventCategory.ENVIRONMENTAL);
    assert.equal(ev.type, EventType.WEATHER);
    assert.equal(ev.location.lat, 12.95);
    assert.equal(ev.location.lon, 77.67);
    assert.equal(ev.payload.temperatureC, 24.5);
    assert.equal(ev.payload.windSpeedMps, 5.0);
    assert.equal(ev.payload.rainfallMm, 45.2);
    assert.equal(ev.payload.rainfall1hMm, 12.0);
    assert.equal(ev.provenance.isOfficial, true);
    assert.equal(ev.provenance.authority, 'India Meteorological Department');
  });

  test('IMDWarningAdapter normalizes district-level warnings preserving alert level', () => {
    const adapter = new IMDWarningAdapter();
    const rawWarnings = [
      {
        warning_id: 'imd_warn_ka_0820_01',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        latitude: 12.97,
        longitude: 77.59,
        color: 'RED',
        hazard_type: 'EXTREME_RAINFALL',
        headline: 'Red Alert: Extremely Heavy Rainfall expected over Bengaluru Urban',
        description: 'Isolated extremely heavy rainfall (>204.4 mm) likely.',
        instruction: 'Avoid waterlogged low-lying areas. Stay indoors.',
        issued_at: '2026-08-20T06:00:00Z',
        valid_until: '2026-08-21T06:00:00Z',
      },
    ];

    const result = adapter.safeNormalize(rawWarnings);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.HAZARD);
    assert.equal(ev.type, EventType.OFFICIAL_WARNING);
    assert.equal(ev.payload.warningColor, 'RED');
    assert.equal(ev.payload.severity, 'CRITICAL');
    assert.equal(ev.confidence, 1.0); // Official authority alert
    assert.equal(ev.provenance.isOfficial, true);
  });

  test('IMDCycloneAdapter normalizes tropical cyclone tracking bulletins', () => {
    const adapter = new IMDCycloneAdapter();
    const rawCyclone = {
      cyclone_id: 'bob_2026_02',
      cyclone_name: 'MONSOON_CYCLONE_ASANI_II',
      stage: 'Very Severe Cyclonic Storm',
      latitude: 15.4,
      longitude: 86.8,
      central_pressure_hpa: 976,
      max_wind_kmph: 140, // ~38.89 m/s
      forecast_track: [
        { lat: 15.4, lon: 86.8, time: '2026-08-20T12:00:00Z', intensity_kmph: 140 },
        { lat: 16.8, lon: 85.2, time: '2026-08-21T00:00:00Z', intensity_kmph: 155 },
        { lat: 18.2, lon: 84.1, time: '2026-08-21T12:00:00Z', intensity_kmph: 130 },
      ],
      timestamp: '2026-08-20T12:00:00Z',
    };

    const result = adapter.safeNormalize(rawCyclone);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.category, EventCategory.HAZARD);
    assert.equal(ev.type, EventType.CYCLONE);
    assert.equal(ev.payload.cycloneName, 'MONSOON_CYCLONE_ASANI_II');
    assert.equal(ev.payload.centralPressureHpa, 976);
    assert.ok(ev.payload.maxSustainedWindMps > 38.8 && ev.payload.maxSustainedWindMps < 39.0);
    assert.equal(ev.payload.forecastTrack.length, 3);
    assert.equal(ev.provenance.authority, 'India Meteorological Department (RSMC New Delhi)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STEP 2: SACHET (NDMA CAP 1.2 ALERT SYSTEM) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Step 2: SACHET NDMA CAP Alert Adapter', () => {
  test('normalizes OASIS CAP 1.2 alerts preserving all mandatory metadata and polygon geometry', () => {
    const adapter = new SACHETAdapter();
    const rawCapAlert = {
      identifier: 'NDMA-CAP-IN-2026-0820-9941',
      sender: 'NDMA-HQ-NEW-DELHI',
      sent: '2026-08-20T08:30:00+05:30',
      status: 'Actual',
      msgType: 'Alert',
      scope: 'Public',
      info: {
        category: 'Met',
        event: 'Flash Flood Alert',
        urgency: 'Immediate',
        severity: 'Severe',
        certainty: 'Observed',
        headline: 'Flash Flood Warning for Coastal Karnataka and Udupi District',
        description: 'River Netravati and Swarna flowing above danger level.',
        instruction: 'Move immediately to elevated shelter. Follow SDRF instructions.',
        effective: '2026-08-20T08:30:00+05:30',
        expires: '2026-08-21T08:30:00+05:30',
        area: {
          areaDesc: 'Udupi, Dakshina Kannada Coastal Belt',
          polygon: '13.34,74.74 13.50,74.80 13.20,75.00 13.00,74.85 13.34,74.74',
        },
      },
    };

    const result = adapter.safeNormalize(rawCapAlert);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.source, 'SACHET');
    assert.equal(ev.category, EventCategory.HAZARD);
    assert.equal(ev.type, EventType.OFFICIAL_WARNING);
    assert.equal(ev.geometry.type, 'Polygon');
    assert.equal(ev.geometry.coordinates[0].length, 5); // Closed polygon
    assert.equal(ev.provenance.isOfficial, true);
    assert.equal(ev.provenance.capVersion, '1.2');
    assert.equal(ev.payload.urgency, 'Immediate');
    assert.equal(ev.payload.severity, 'SEVERE');
    assert.equal(ev.payload.certainty, 'Observed');
    assert.equal(ev.payload.isOfficialWarning, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. STEP 3: GDACS & SCENARIO A (EARTHQUAKE CORROBORATION) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Step 3: GDACS Multi-Hazard & Scenario A Corroboration', () => {
  test('GDACSAdapter normalizes multi-hazard alerts with alert levels and population estimate', () => {
    const adapter = new GDACSAdapter();
    const rawGdacs = {
      features: [
        {
          properties: {
            eventid: '1002345',
            eventtype: 'EQ',
            name: 'M 7.7 Flores Sea Megathrust',
            alertlevel: 'Red',
            alertscore: 2.5,
            country: 'Indonesia',
            population: 1450000,
            magnitude: 7.7,
            fromdate: '2026-08-20T04:12:00Z',
          },
          geometry: {
            type: 'Point',
            coordinates: [121.58, -8.24, 12.0], // lon, lat, depth
          },
        },
      ],
    };

    const result = adapter.safeNormalize(rawGdacs);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.source, 'GDACS');
    assert.equal(ev.category, EventCategory.HAZARD);
    assert.equal(ev.type, EventType.EARTHQUAKE);
    assert.equal(ev.location.lat, -8.24);
    assert.equal(ev.location.lon, 121.58);
    assert.equal(ev.location.depthKm, 12.0);
    assert.equal(ev.payload.alertLevel, 'RED');
    assert.equal(ev.payload.populationExposed, 1450000);
  });

  test('SCENARIO A: USGS M7.7 and GDACS M7.7 coexist in DataPipeline without overwriting', () => {
    const pipeline = new DataPipeline();

    // 1. Ingest USGS observation
    const usgsEvent = {
      id: 'usgs_quake_us7000flores',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T04:12:00Z',
      receivedAt: '2026-08-20T04:12:30Z',
      processedAt: '2026-08-20T04:12:31Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0 },
      provenance: { source: 'USGS', providerEventId: 'us7000flores' },
      confidence: 0.98,
      freshness: { status: 'LIVE' },
      payload: { magnitude: 7.7, tsunamiFlag: true },
    };

    // 2. Ingest GDACS observation
    const gdacsEvent = {
      id: 'gdacs_eq_1002345',
      source: 'GDACS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: '2026-08-20T04:12:00Z',
      receivedAt: '2026-08-20T04:13:00Z',
      processedAt: '2026-08-20T04:13:01Z',
      location: { lat: -8.24, lon: 121.58, depthKm: 12.0 },
      provenance: { source: 'GDACS', providerEventId: '1002345', alertLevel: 'RED' },
      confidence: 0.98,
      freshness: { status: 'LIVE' },
      payload: { magnitude: 7.7, alertLevel: 'RED', populationExposed: 1450000 },
    };

    pipeline.ingestCanonical([usgsEvent]);
    pipeline.ingestCanonical([gdacsEvent]);

    const allEvents = pipeline.getEvents({ type: EventType.EARTHQUAKE });
    assert.equal(allEvents.length, 2, 'Both USGS and GDACS observations must be preserved');

    const sources = allEvents.map((e) => e.source);
    assert.ok(sources.includes('USGS'));
    assert.ok(sources.includes('GDACS'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STEP 4: NASA FIRMS & SCENARIO B (FIRE OBSERVATIONS) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Step 4: NASA FIRMS & Scenario B Fire Observations', () => {
  test('FIRMSAdapter normalizes VIIRS & MODIS active fire hotspots preserving FRP and brightness', () => {
    const adapter = new FIRMSAdapter();
    const rawFirms = [
      {
        latitude: 34.12,
        longitude: -118.45,
        brightness: 348.6,
        scan: 0.4,
        track: 0.6,
        acq_date: '2026-08-20',
        acq_time: '1430',
        satellite: 'VIIRS_NOAA20',
        instrument: 'VIIRS',
        confidence: 'high',
        version: '2.0NRT',
        bright_t31: 295.2,
        frp: 74.8, // 74.8 MW Fire Radiative Power
        daynight: 'D',
      },
    ];

    const result = adapter.safeNormalize(rawFirms);
    assert.equal(result.error, null);
    assert.equal(result.count, 1);

    const ev = result.events[0];
    assert.equal(ev.source, 'NASA_FIRMS');
    assert.equal(ev.category, EventCategory.HAZARD);
    assert.equal(ev.type, EventType.WILDFIRE_HOTSPOT);
    assert.equal(ev.location.lat, 34.12);
    assert.equal(ev.location.lon, -118.45);
    assert.equal(ev.payload.frpMW, 74.8);
    assert.equal(ev.payload.brightnessKelvin, 348.6);
    assert.equal(ev.payload.satellite, 'VIIRS_NOAA20');
    assert.equal(ev.confidence, 0.95);
  });

  test('SCENARIO B: Multiple hotspots produce raw observations, NOT separate instant crises', () => {
    const adapter = new FIRMSAdapter();
    // Simulate a cluster of 5 hotspots in the same area
    const cluster = Array.from({ length: 5 }, (_, i) => ({
      latitude: 34.12 + i * 0.005,
      longitude: -118.45 + i * 0.005,
      brightness: 330 + i * 5,
      frp: 40 + i * 10,
      confidence: 'nominal',
      acq_date: '2026-08-20',
      acq_time: '1430',
    }));

    const result = adapter.safeNormalize(cluster);
    assert.equal(result.count, 5);

    // Verify all 5 are raw WILDFIRE_HOTSPOT observations
    for (const ev of result.events) {
      assert.equal(ev.type, EventType.WILDFIRE_HOTSPOT);
      assert.equal(ev.category, EventCategory.HAZARD);
      assert.ok(ev.payload.frpMW >= 40);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. STEP 5: WORLDPOP & SCENARIO E (POPULATION EXPOSURE BASELINE) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Step 5: WorldPop Exposure Service & Scenario E', () => {
  test('SCENARIO E: calculateExposure computes zonal population with method tagging and metadata', () => {
    const service = new WorldPopService();

    // 1. Bengaluru urban area (high density corridor)
    const bengaluruResult = service.calculateExposure({
      lat: 12.97,
      lon: 77.59,
      radiusKm: 10, // 10 km radius ~ 314.16 km^2
    });

    assert.ok(bengaluruResult.estimatedPopulation > 1000000);
    assert.equal(bengaluruResult.method, 'EXACT_ZONAL_GRID');
    assert.equal(bengaluruResult.dataState, DataState.STATIC);
    assert.ok(bengaluruResult.dataset.includes('WorldPop'));
    assert.ok(bengaluruResult.limitations);

    // 2. Rural / remote point (geometric approximation fallback)
    const remoteResult = service.calculateExposure({
      lat: -45.0,
      lon: -120.0,
      radiusKm: 25,
      options: { forceApproximation: true },
    });

    assert.equal(remoteResult.method, 'GEOMETRIC_DENSITY_APPROXIMATION');
    assert.ok(remoteResult.estimatedPopulation > 0);

    // 3. Radius = 0 returns 0 population
    const zeroResult = service.calculateExposure({ lat: 12.97, lon: 77.59, radiusKm: 0 });
    assert.equal(zeroResult.estimatedPopulation, 0);

    // 4. Invalid inputs return status: UNAVAILABLE, never fabricated numbers
    const invalidResult = service.calculateExposure({ lat: 'invalid', lon: null, radiusKm: -5 });
    assert.equal(invalidResult.estimatedPopulation, null);
    assert.equal(invalidResult.status, 'UNAVAILABLE');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. STEP 6: COPERNICUS DEM & SCENARIO F (TERRAIN ELEVATION BASELINE) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Step 6: Copernicus DEM Terrain Service & Scenario F', () => {
  test('SCENARIO F: getElevation strictly separates source elevation from derived slope', () => {
    const service = new CopernicusDEMService();

    // 1. Chamoli / Himalaya profile (mountainous)
    const himalaya = service.getElevation(30.4, 79.35);
    assert.ok(himalaya.elevationMeters >= 3000, 'Himalayan elevation should reflect mountain baseline');
    assert.equal(himalaya.dataState, DataState.STATIC);
    assert.equal(himalaya.terrainType, 'Mountainous');

    // Derived slope must be in derived namespace, NOT reported as raw source measurement
    assert.ok(himalaya.derived);
    assert.ok(himalaya.derived.slopeDegrees > 20);
    assert.equal(himalaya.derived.calculationMethod, 'FINITE_DIFFERENCE_DERIVATIVE');

    // 2. Bengaluru Plateau profile
    const plateau = service.getElevation(12.97, 77.59);
    assert.ok(plateau.elevationMeters >= 900 && plateau.elevationMeters <= 950);
    assert.equal(plateau.terrainType, 'Plateau');
    assert.ok(plateau.derived.slopeDegrees < 10);

    // 3. Terrain profile across multiple coordinates
    const profile = service.getTerrainProfile([
      { lat: 12.97, lon: 77.59 },
      { lat: 30.4, lon: 79.35 },
    ]);
    assert.equal(profile.length, 2);
    assert.equal(profile[0].terrainType, 'Plateau');
    assert.equal(profile[1].terrainType, 'Mountainous');

    // 4. Invalid input returns UNAVAILABLE
    const invalid = service.getElevation(null, undefined);
    assert.equal(invalid.elevationMeters, null);
    assert.equal(invalid.status, 'UNAVAILABLE');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. END-TO-END PIPELINE, REGISTRY & CAPABILITY INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('End-to-End Pipeline & Capability Matrix in Phase 6B', () => {
  test('all 16 current providers are registered and active in the global registry', () => {
    assert.equal(globalProviderRegistry.size, 18); // 16 connected + 2 planned (CWC & EMS)
    const connected = globalProviderRegistry.getConnected();
    assert.equal(connected.length, 16);

    const planned = globalProviderRegistry.getPlanned();
    assert.equal(planned.length, 2);
    const plannedIds = planned.map((p) => p.id);
    assert.ok(plannedIds.includes('CWC_FLOOD'));
    assert.ok(plannedIds.includes('COPERNICUS_EMS'));
  });

  test('CapabilityRegistry correctly evaluates AVAILABLE status for newly connected providers', () => {
    // Record success for all connected providers
    for (const p of globalProviderRegistry.getConnected()) {
      globalProviderHealthTracker.recordSuccess(p.id, 50);
    }

    const capabilities = globalCapabilityRegistry.evaluate();

    // Verify key disaster capabilities are now AVAILABLE
    const eqCap = capabilities.get('EARTHQUAKE_DETECTION');
    assert.equal(eqCap.status, CapabilityStatus.AVAILABLE);

    const fireCap = capabilities.get('WILDFIRE_HOTSPOT_DETECTION');
    assert.equal(fireCap.status, CapabilityStatus.AVAILABLE);

    const warningCap = capabilities.get('OFFICIAL_WARNING_OFFICIAL_WARNING');
    assert.equal(warningCap.status, CapabilityStatus.AVAILABLE);

    const cycloneCap = capabilities.get('CYCLONE_DETECTION');
    assert.equal(cycloneCap.status, CapabilityStatus.AVAILABLE);

    // CWC / Flood forecast remains PLANNED
    const floodForecast = capabilities.get('FLOOD_SIGNAL_FORECAST');
    assert.equal(floodForecast.status, CapabilityStatus.PLANNED);
  });

  test('DataFabric ingests events from new providers with enriched provenance', () => {
    const saAlertEvent = {
      id: 'test_sachet_ingest_01',
      source: 'SACHET',
      sourceMode: SourceMode.LIVE,
      type: EventType.OFFICIAL_WARNING,
      category: EventCategory.HAZARD,
      observedAt: new Date().toISOString(),
      location: { lat: 13.0, lon: 77.5 },
      provenance: { source: 'SACHET' },
      confidence: 1.0,
      freshness: { status: 'LIVE' },
      payload: { headline: 'Test Alert' },
    };

    const result = globalDataFabric.ingest('SACHET_WARNINGS', [saAlertEvent]);
    assert.equal(result.accepted, 1);
    assert.equal(result.error, null);

    const storedEvents = globalDataFabric.query({ type: EventType.OFFICIAL_WARNING });
    const match = storedEvents.find((e) => e.id === 'test_sachet_ingest_01');
    assert.ok(match);
    assert.equal(match.provenance.providerId, 'SACHET_WARNINGS');
    assert.equal(match.provenance.providerTier, ProviderTier.TIER_A);
  });

  test('Failure Isolation: Failure in one provider does not affect other feeds', () => {
    // Record failure in FIRMS
    globalProviderHealthTracker.recordFailure('NASA_FIRMS_FIRE', 'TIMEOUT', 'Connection timeout');
    const firmsHealth = globalProviderHealthTracker.getHealth('NASA_FIRMS_FIRE');
    assert.ok(firmsHealth.errorCount > 0);

    // USGS and SACHET remain healthy
    const usgsHealth = globalProviderHealthTracker.getHealth('USGS_EARTHQUAKE');
    assert.equal(usgsHealth.status, ProviderStatus.HEALTHY);

    // Ingestion through healthy provider continues working
    const usgsTestEvent = {
      id: 'test_usgs_iso_01',
      source: 'USGS',
      sourceMode: SourceMode.LIVE,
      type: EventType.EARTHQUAKE,
      category: EventCategory.HAZARD,
      observedAt: new Date().toISOString(),
      location: { lat: 35.0, lon: -118.0 },
      provenance: { source: 'USGS' },
      confidence: 0.95,
      freshness: { status: 'LIVE' },
      payload: { magnitude: 4.5 },
    };

    const result = globalDataFabric.ingest('USGS_EARTHQUAKE', [usgsTestEvent]);
    assert.equal(result.accepted, 1);
    assert.equal(result.error, null);
  });
});
