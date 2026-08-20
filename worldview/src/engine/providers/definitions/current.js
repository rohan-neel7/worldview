/**
 * Worldview Data Fabric — Current Connected Provider Definitions
 *
 * All verified, active provider definitions in Worldview Phase 6B:
 *   - USGS_EARTHQUAKE: Authority Earthquake Sensor Feed (EVENT_PROVIDER)
 *   - OPENSKY_FLIGHTS: Live Air Traffic State Vectors (EVENT_PROVIDER)
 *   - CELESTRAK_SATELLITES: Live Orbital Ephemerides (EVENT_PROVIDER)
 *   - AISSTREAM_VESSELS: Real-time Maritime AIS Stream (EVENT_PROVIDER)
 *   - OPEN_METEO_WEATHER: Numerical Weather Forecast (EVENT_PROVIDER)
 *   - ADSB_LOL_MILITARY: Military Flight Tracker (EVENT_PROVIDER)
 *   - SIMULATION_ENGINE: Synthetic Disaster Scenario Engine (EVENT_PROVIDER)
 *   - NOAA_NEXRAD_RADAR: Weather Radar Imagery Baseline (VISUALIZATION_PROVIDER)
 *   - IMD_WEATHER: IMD Station Weather & Rainfall (OBSERVATION_PROVIDER)
 *   - IMD_WARNINGS: IMD District & State Weather Alerts (WARNING_PROVIDER)
 *   - IMD_CYCLONE: IMD Cyclone Tracking Bulletins (EVENT_PROVIDER)
 *   - SACHET_WARNINGS: NDMA CAP 1.2 Official Alerts (WARNING_PROVIDER)
 *   - GDACS_ALERTS: UN/EC Global Multi-Hazard Corroboration (EVENT_PROVIDER)
 *   - NASA_FIRMS_FIRE: VIIRS/MODIS Thermal Hotspots (OBSERVATION_PROVIDER)
 *   - WORLDPOP_EXPOSURE: Gridded Demographic Exposure Baseline (EXPOSURE_PROVIDER)
 *   - COPERNICUS_DEM: Global Digital Elevation Baseline (GEOSPATIAL_PROVIDER)
 *
 * All have `connected: true`, explicit `ProviderClass`, and comprehensive verification metadata.
 * Immutable definitions created via createProviderDefinition().
 */

import { createProviderDefinition } from '../ProviderContract.js';
import {
  ProviderTier,
  ProviderRole,
  DataState,
  CoverageType,
  TemporalResolution,
  AuthType,
  LicenseStatus,
  AccessType,
  ProviderOwnership,
  ProviderClass,
} from '../providerTypes.js';
import { SourceMode } from '../../event/types.js';

// ── 1. USGS EARTHQUAKE (Authority / Official) ────────────────────────────────

export const USGS_EARTHQUAKE = createProviderDefinition({
  id: 'USGS_EARTHQUAKE',
  name: 'USGS Earthquakes',
  organization: 'United States Geological Survey',
  tier: ProviderTier.TIER_A,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['EARTHQUAKE'],
  roles: [ProviderRole.DETECTION, ProviderRole.CONFIRMATION, ProviderRole.IMPACT],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.SHARED,
  adapterKey: 'USGS',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.EVENT_DRIVEN,
    expectedFreshnessMs: 300000,
    expectedLatencyMs: 5000,
  },
  runtimeConfig: {
    timeoutMs: 10000,
    pollIntervalMs: 300000,
    maxRetries: 3,
    backoffBaseMs: 1000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 1,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'USGS',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://earthquake.usgs.gov/fdsnws/event/1/',
      accessNotes: 'Public GeoJSON feed, no authentication required',
      limitations: 'Rate-limited on high-frequency polling',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 2. OPENSKY FLIGHTS (Operational Context) ─────────────────────────────────

export const OPENSKY_FLIGHTS = createProviderDefinition({
  id: 'OPENSKY_FLIGHTS',
  name: 'OpenSky Network Flights',
  organization: 'OpenSky Network',
  tier: ProviderTier.TIER_C,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['AIRCRAFT'],
  roles: [ProviderRole.CONTEXT, ProviderRole.ACCESS],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.WORLD,
  adapterKey: 'OPENSKY',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.SECONDS,
    expectedFreshnessMs: 60000,
    expectedLatencyMs: 3000,
  },
  runtimeConfig: {
    timeoutMs: 6000,
    pollIntervalMs: 10000,
    maxRetries: 2,
    backoffBaseMs: 1000,
    backoffMaxMs: 30000,
    rateLimitPerMinute: 10,
    priority: 3,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'OpenSky Network (https://opensky-network.org)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://opensky-network.org/apidoc/',
      accessNotes: 'Anonymous access, rate-limited to ~100 requests/day',
      limitations: 'Aggressive rate-limiting, frequent 429 responses',
    },
  },
  fallback: {
    providerId: null,
    strategy: 'STATIC_JSON_FILE',
    degradationNotice: 'Using static flight data — positions are not live',
  },
});

// ── 3. CELESTRAK SATELLITES (Scientific Ephemeris) ───────────────────────────

export const CELESTRAK_SATELLITES = createProviderDefinition({
  id: 'CELESTRAK_SATELLITES',
  name: 'CelesTrak Satellite Tracking',
  organization: 'CelesTrak / NORAD',
  tier: ProviderTier.TIER_B,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['SATELLITE'],
  roles: [ProviderRole.CONTEXT],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.WORLD,
  adapterKey: 'CELESTRAK',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.MINUTES,
    expectedFreshnessMs: 120000,
    expectedLatencyMs: 3000,
  },
  runtimeConfig: {
    timeoutMs: 20000,
    pollIntervalMs: 30000,
    maxRetries: 2,
    backoffBaseMs: 2000,
    backoffMaxMs: 30000,
    rateLimitPerMinute: null,
    priority: 2,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'CelesTrak / Dr. T.S. Kelso',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://celestrak.org/NORAD/elements/',
      accessNotes: 'Public TLE data, orbital propagation via satellite.js',
      limitations: 'TLE refresh latency, occasional upstream timeout',
    },
  },
  fallback: {
    providerId: null,
    strategy: 'LOCAL_TLE_FILE',
    degradationNotice: 'Using locally cached TLE data — positions may drift',
  },
});

// ── 4. AISSTREAM VESSELS (Maritime Transponders) ──────────────────────────────

export const AISSTREAM_VESSELS = createProviderDefinition({
  id: 'AISSTREAM_VESSELS',
  name: 'AISStream Maritime Vessels',
  organization: 'AISStream',
  tier: ProviderTier.TIER_C,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['VESSEL'],
  roles: [ProviderRole.CONTEXT, ProviderRole.ACCESS],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.WORLD,
  adapterKey: 'AISSTREAM',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.SECONDS,
    expectedFreshnessMs: 300000,
    expectedLatencyMs: 2000,
  },
  runtimeConfig: {
    timeoutMs: 10000,
    pollIntervalMs: 3000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 3,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.API_KEY, secretRef: 'AISSTREAM_API_KEY' },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'AISStream.io',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://aisstream.io/documentation',
      accessNotes: 'WebSocket streaming API, requires API key',
      limitations: 'WebSocket connection requires auto-reconnection logic',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 5. OPEN-METEO WEATHER (Global Numerical Forecast) ─────────────────────────

export const OPEN_METEO_WEATHER = createProviderDefinition({
  id: 'OPEN_METEO_WEATHER',
  name: 'Open-Meteo Weather Forecast',
  organization: 'Open-Meteo',
  tier: ProviderTier.TIER_C,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['WEATHER'],
  roles: [ProviderRole.CONTEXT, ProviderRole.FORECAST],
  dataState: DataState.FORECAST,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.SHARED,
  adapterKey: 'OPENMETEO',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.HOURLY,
    expectedFreshnessMs: 3600000,
    expectedLatencyMs: 2000,
  },
  runtimeConfig: {
    timeoutMs: 10000,
    pollIntervalMs: 300000,
    maxRetries: 3,
    backoffBaseMs: 1000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 4,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'Open-Meteo.com',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://open-meteo.com/en/docs',
      accessNotes: 'Free tier, no key needed for reasonable usage',
      limitations: 'Hourly resolution, non-official numerical model',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 6. ADSB.LOL MILITARY AIRCRAFT ───────────────────────────────────────────

export const ADSB_LOL_MILITARY = createProviderDefinition({
  id: 'ADSB_LOL_MILITARY',
  name: 'ADSB.lol Military Aircraft',
  organization: 'adsb.lol community',
  tier: ProviderTier.TIER_C,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['AIRCRAFT'],
  roles: [ProviderRole.CONTEXT, ProviderRole.ACCESS],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.WORLD,
  adapterKey: 'ADSB.LOL',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.SECONDS,
    expectedFreshnessMs: 60000,
    expectedLatencyMs: 2000,
  },
  runtimeConfig: {
    timeoutMs: 10000,
    pollIntervalMs: 30000,
    maxRetries: 2,
    backoffBaseMs: 1000,
    backoffMaxMs: 30000,
    rateLimitPerMinute: null,
    priority: 4,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.UNVERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'adsb.lol community',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://api.adsb.lol/',
      accessNotes: 'Community-run aggregator, public API',
      limitations: 'Feeder-dependent coverage, no formal SLA',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 7. SIMULATION ENGINE ────────────────────────────────────────────────────

export const SIMULATION_ENGINE = createProviderDefinition({
  id: 'SIMULATION_ENGINE',
  name: 'Worldview Simulation Engine',
  organization: 'Worldview',
  tier: ProviderTier.TIER_D,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['EARTHQUAKE', 'FLOOD_SIGNAL', 'WEATHER', 'GENERIC_OBSERVATION'],
  roles: [ProviderRole.SIMULATION],
  dataState: DataState.SIMULATED,
  sourceMode: SourceMode.SIMULATED,
  ownership: ProviderOwnership.SHARED,
  adapterKey: 'SIMULATION',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.ON_DEMAND,
    expectedFreshnessMs: 3600000,
    expectedLatencyMs: 100,
  },
  runtimeConfig: {
    timeoutMs: 5000,
    pollIntervalMs: 0,
    maxRetries: 0,
    backoffBaseMs: 0,
    backoffMaxMs: 0,
    rateLimitPerMinute: null,
    priority: 10,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.INTERNAL, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'Worldview Simulation Engine',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'Internal',
      accessNotes: 'Deterministic scenario runner',
      limitations: 'Synthetic data only',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 8. NOAA NEXRAD RADAR (Visualization Baseline) ───────────────────────────

export const NOAA_NEXRAD_RADAR = createProviderDefinition({
  id: 'NOAA_NEXRAD_RADAR',
  name: 'NOAA NEXRAD Weather Radar',
  organization: 'NOAA / NWS',
  tier: ProviderTier.TIER_C,
  providerClass: ProviderClass.VISUALIZATION_PROVIDER,
  dataTypes: ['WEATHER_RADAR'],
  roles: [ProviderRole.CONTEXT],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.WORLD,
  adapterKey: null,
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.COUNTRY, countries: ['US'] },
  temporalResolution: {
    type: TemporalResolution.MINUTES,
    expectedFreshnessMs: 300000,
    expectedLatencyMs: 3000,
  },
  runtimeConfig: {
    timeoutMs: 10000,
    pollIntervalMs: 300000,
    maxRetries: 2,
    backoffBaseMs: 2000,
    backoffMaxMs: 30000,
    rateLimitPerMinute: null,
    priority: 5,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'NOAA National Weather Service',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://opengeo.ncep.noaa.gov/',
      accessNotes: 'WMS tile endpoint for Cesium imagery layer',
      limitations: 'CONUS coverage only',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 9. IMD WEATHER OBSERVATIONS (India Meteorological Dept) ──────────────────

export const IMD_WEATHER = createProviderDefinition({
  id: 'IMD_WEATHER',
  name: 'India Meteorological Department (Weather & Rainfall)',
  organization: 'IMD / MoES India',
  tier: ProviderTier.TIER_A,
  providerClass: ProviderClass.OBSERVATION_PROVIDER,
  dataTypes: ['WEATHER', 'RAINFALL'],
  roles: [ProviderRole.CONTEXT, ProviderRole.DETECTION],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.SHARED,
  adapterKey: 'IMD_WEATHER',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.COUNTRY, countries: ['IN'] },
  temporalResolution: {
    type: TemporalResolution.HOURLY,
    expectedFreshnessMs: 3600000,
    expectedLatencyMs: 5000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 300000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 1,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.GOVERNMENT,
      attribution: 'India Meteorological Department (IMD)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://api.imd.gov.in/',
      accessNotes: 'Official IMD API Management Platform JSON endpoints',
      limitations: 'Station density varies across mountain and coastal tracts',
    },
  },
  fallback: {
    providerId: 'OPEN_METEO_WEATHER',
    strategy: 'NON_AUTHORITATIVE_FALLBACK',
    degradationNotice: 'Official IMD feed unavailable; utilizing Open-Meteo as fallback',
  },
});

// ── 10. IMD DISTRICT & STATE WARNINGS (Official Alert) ───────────────────────

export const IMD_WARNINGS = createProviderDefinition({
  id: 'IMD_WARNINGS',
  name: 'IMD District Weather Warnings & Nowcasts',
  organization: 'IMD / MoES India',
  tier: ProviderTier.TIER_A,
  providerClass: ProviderClass.WARNING_PROVIDER,
  dataTypes: ['OFFICIAL_WARNING'],
  roles: [ProviderRole.OFFICIAL_WARNING, ProviderRole.DETECTION],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.CRISIS,
  adapterKey: 'IMD_WARNINGS',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.COUNTRY, countries: ['IN'] },
  temporalResolution: {
    type: TemporalResolution.HOURLY,
    expectedFreshnessMs: 86400000,
    expectedLatencyMs: 5000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 300000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 1,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.GOVERNMENT,
      attribution: 'India Meteorological Department (IMD)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://api.imd.gov.in/warnings/',
      accessNotes: 'Official district-wise color-coded weather alert bulletins',
      limitations: 'Administrative district boundary resolution',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 11. IMD CYCLONE TRACKING ────────────────────────────────────────────────

export const IMD_CYCLONE = createProviderDefinition({
  id: 'IMD_CYCLONE',
  name: 'IMD Cyclone Tracking & Bulletins',
  organization: 'IMD RSMC New Delhi',
  tier: ProviderTier.TIER_A,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['CYCLONE', 'HAZARD_TRACK'],
  roles: [ProviderRole.DETECTION, ProviderRole.FORECAST, ProviderRole.OFFICIAL_WARNING],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.CRISIS,
  adapterKey: 'IMD_CYCLONE',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.COUNTRY, countries: ['IN'] },
  temporalResolution: {
    type: TemporalResolution.EVENT_DRIVEN,
    expectedFreshnessMs: 21600000,
    expectedLatencyMs: 5000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 600000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 1,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.GOVERNMENT,
      attribution: 'India Meteorological Department (RSMC New Delhi)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://rsmcnewdelhi.imd.gov.in/',
      accessNotes: 'Official tropical cyclone advisories and cone forecasts for NIO basin',
      limitations: 'Active only during tropical cyclonic disturbances',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 12. SACHET NDMA CAP ALERTS ──────────────────────────────────────────────

export const SACHET_WARNINGS = createProviderDefinition({
  id: 'SACHET_WARNINGS',
  name: 'SACHET Early Warning System',
  organization: 'NDMA India',
  tier: ProviderTier.TIER_A,
  providerClass: ProviderClass.WARNING_PROVIDER,
  dataTypes: ['OFFICIAL_WARNING'],
  roles: [ProviderRole.OFFICIAL_WARNING, ProviderRole.DETECTION],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.CRISIS,
  adapterKey: 'SACHET',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.COUNTRY, countries: ['IN'] },
  temporalResolution: {
    type: TemporalResolution.EVENT_DRIVEN,
    expectedFreshnessMs: 86400000,
    expectedLatencyMs: 10000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 300000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 1,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.GOVERNMENT,
      attribution: 'National Disaster Management Authority (NDMA / SACHET)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://sachet.ndma.gov.in/',
      accessNotes: 'OASIS CAP 1.2 standardized emergency alert feed',
      limitations: 'State agency ingestion latency may vary',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 13. GDACS GLOBAL MULTI-HAZARD ───────────────────────────────────────────

export const GDACS_ALERTS = createProviderDefinition({
  id: 'GDACS_ALERTS',
  name: 'Global Disaster Alerting System',
  organization: 'UN OCHA / European Commission JRC',
  tier: ProviderTier.TIER_A,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['EARTHQUAKE', 'FLOOD_SIGNAL', 'CYCLONE', 'WILDFIRE_HOTSPOT'],
  roles: [ProviderRole.DETECTION, ProviderRole.CONFIRMATION, ProviderRole.OFFICIAL_WARNING],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.SHARED,
  adapterKey: 'GDACS',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.EVENT_DRIVEN,
    expectedFreshnessMs: 86400000,
    expectedLatencyMs: 10000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 600000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 1,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'GDACS (UN OCHA / EC JRC)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://www.gdacs.org/gdacsapi/api',
      accessNotes: 'Public REST and GeoJSON multi-hazard API',
      limitations: 'Global automatic alerts are subject to subsequent human review',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 14. NASA FIRMS ACTIVE FIRE (VIIRS / MODIS) ──────────────────────────────

export const NASA_FIRMS_FIRE = createProviderDefinition({
  id: 'NASA_FIRMS_FIRE',
  name: 'NASA FIRMS Active Fire Observations',
  organization: 'NASA LANCE / EOSDIS',
  tier: ProviderTier.TIER_B,
  providerClass: ProviderClass.OBSERVATION_PROVIDER,
  dataTypes: ['WILDFIRE_HOTSPOT'],
  roles: [ProviderRole.DETECTION, ProviderRole.CONFIRMATION],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.SHARED,
  adapterKey: 'NASA_FIRMS',
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.MINUTES,
    expectedFreshnessMs: 43200000,
    expectedLatencyMs: 5000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 600000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 2,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.API_KEY, secretRef: 'NASA_FIRMS_MAP_KEY' },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'NASA FIRMS (https://firms.modaps.eosdis.nasa.gov)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://firms.modaps.eosdis.nasa.gov/api/',
      accessNotes: 'Near Real-Time VIIRS (NOAA-20/21) & MODIS active fire hotspots with FRP',
      limitations: 'Satellite overpass schedule, heavy cloud cover obscuration',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 15. WORLDPOP POPULATION EXPOSURE BASELINE ────────────────────────────────

export const WORLDPOP_EXPOSURE = createProviderDefinition({
  id: 'WORLDPOP_EXPOSURE',
  name: 'WorldPop Gridded Population Exposure Baseline',
  organization: 'WorldPop / University of Southampton',
  tier: ProviderTier.TIER_B,
  providerClass: ProviderClass.EXPOSURE_PROVIDER,
  dataTypes: ['POPULATION_EXPOSURE'],
  roles: [ProviderRole.EXPOSURE],
  dataState: DataState.STATIC,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.SHARED,
  adapterKey: null, // Geospatial baseline service — accessed via WorldPopService
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.STATIC,
    expectedFreshnessMs: 86400000 * 365,
    expectedLatencyMs: 1000,
  },
  runtimeConfig: {
    timeoutMs: 10000,
    pollIntervalMs: 0,
    maxRetries: 2,
    backoffBaseMs: 1000,
    backoffMaxMs: 30000,
    rateLimitPerMinute: null,
    priority: 5,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'WorldPop (https://www.worldpop.org)',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://www.worldpop.org/rest/data',
      accessNotes: 'UN-adjusted global 1km / 100m gridded demographic dataset',
      limitations: 'Static annual baseline; does not measure real-time dynamic evacuations',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

// ── 16. COPERNICUS DEM TERRAIN BASELINE ─────────────────────────────────────

export const COPERNICUS_DEM = createProviderDefinition({
  id: 'COPERNICUS_DEM',
  name: 'Copernicus Digital Elevation Model (GLO-30 / GLO-90)',
  organization: 'ESA / Copernicus Data Space Ecosystem',
  tier: ProviderTier.TIER_B,
  providerClass: ProviderClass.GEOSPATIAL_PROVIDER,
  dataTypes: ['ELEVATION'],
  roles: [ProviderRole.CONTEXT],
  dataState: DataState.STATIC,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.SHARED,
  adapterKey: null, // Geospatial baseline service — accessed via CopernicusDEMService
  version: '1.0',
  connected: true,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.STATIC,
    expectedFreshnessMs: 86400000 * 365,
    expectedLatencyMs: 1000,
  },
  runtimeConfig: {
    timeoutMs: 10000,
    pollIntervalMs: 0,
    maxRetries: 2,
    backoffBaseMs: 1000,
    backoffMaxMs: 30000,
    rateLimitPerMinute: null,
    priority: 6,
    enabled: true,
  },
  governance: {
    auth: { type: AuthType.PUBLIC, secretRef: null },
    license: {
      status: LicenseStatus.VERIFIED,
      accessType: AccessType.OPEN,
      attribution: 'European Space Agency (ESA) / Copernicus',
      redistribution: null,
    },
    verification: {
      status: 'VERIFIED',
      verifiedAt: '2026-08-20',
      verificationSource: 'https://dataspace.copernicus.eu/',
      accessNotes: 'Global 90m GLO-90 open baseline with 30m GLO-30 regional elevation',
      limitations: 'Surface elevation model (DSM), includes vegetation and canopy height',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

/**
 * All currently connected provider definitions in Phase 6B.
 */
export const CURRENT_PROVIDERS = [
  USGS_EARTHQUAKE,
  OPENSKY_FLIGHTS,
  CELESTRAK_SATELLITES,
  AISSTREAM_VESSELS,
  OPEN_METEO_WEATHER,
  ADSB_LOL_MILITARY,
  SIMULATION_ENGINE,
  NOAA_NEXRAD_RADAR,
  IMD_WEATHER,
  IMD_WARNINGS,
  IMD_CYCLONE,
  SACHET_WARNINGS,
  GDACS_ALERTS,
  NASA_FIRMS_FIRE,
  WORLDPOP_EXPOSURE,
  COPERNICUS_DEM,
];
