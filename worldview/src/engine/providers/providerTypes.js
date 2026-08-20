/**
 * Worldview Data Fabric — Provider Type System
 *
 * All frozen enum objects for the provider registry, data fabric,
 * capability system, and lifecycle contracts.
 *
 * Design invariants:
 *   - ProviderTier ≠ confidence (tier is authority classification)
 *   - DataState ≠ FreshnessStatus (nature of data vs age of data)
 *   - ProviderStatus ≠ FreshnessStatus (provider health vs data freshness)
 */

// ── Provider Authority Tier ──────────────────────────────────────────────────
// Classification of the provider's institutional authority.
// TIER_A ≠ 100% confidence — it means the source is an official authority.
export const ProviderTier = Object.freeze({
  TIER_A: 'TIER_A',   // Authority / Official (USGS, IMD, SACHET, CWC)
  TIER_B: 'TIER_B',   // Scientific / Earth Observation (NASA FIRMS, Copernicus, CelesTrak)
  TIER_C: 'TIER_C',   // Operational Context (OpenSky, AIS, OSM, traffic)
  TIER_D: 'TIER_D',   // Simulation (Worldview sim, synthetic, historical replay)
});

// ── Provider Data Role ───────────────────────────────────────────────────────
// What role this provider plays in the intelligence pipeline.
// A provider can declare multiple roles.
export const ProviderRole = Object.freeze({
  DETECTION: 'DETECTION',
  FORECAST: 'FORECAST',
  CONFIRMATION: 'CONFIRMATION',
  IMPACT: 'IMPACT',
  EXPOSURE: 'EXPOSURE',
  ACCESS: 'ACCESS',
  RESPONSE: 'RESPONSE',
  CONTEXT: 'CONTEXT',
  OFFICIAL_WARNING: 'OFFICIAL_WARNING',
  VALIDATION: 'VALIDATION',
  SIMULATION: 'SIMULATION',
});

// ── Data State ───────────────────────────────────────────────────────────────
// Nature of the data produced by this provider.
// Separate from FreshnessStatus (LIVE/RECENT/STALE/EXPIRED) which is age-based.
export const DataState = Object.freeze({
  OBSERVED: 'OBSERVED',     // Direct measurement (USGS seismometer, AIS transponder)
  FORECAST: 'FORECAST',     // Predicted future state (Open-Meteo forecast)
  MODELED: 'MODELED',       // Computational model output (flood model)
  INFERRED: 'INFERRED',     // Derived from indirect evidence (tsunami from earthquake)
  SIMULATED: 'SIMULATED',   // Synthetic scenario data
  STATIC: 'STATIC',         // Unchanging reference dataset (WorldPop, DEM)
  UNKNOWN: 'UNKNOWN',
});

// ── Provider Operational Status ──────────────────────────────────────────────
// Runtime health of the provider connection.
// Independent of data freshness — provider can be HEALTHY but data STALE.
export const ProviderStatus = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  STARTING: 'STARTING',
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  STALE: 'STALE',
  FAILED: 'FAILED',
  DISABLED: 'DISABLED',
});

// ── Geographic Coverage Type ─────────────────────────────────────────────────
export const CoverageType = Object.freeze({
  GLOBAL: 'GLOBAL',
  COUNTRY: 'COUNTRY',
  REGION: 'REGION',
  BBOX: 'BBOX',
  POLYGON: 'POLYGON',
  POINT: 'POINT',
  UNKNOWN: 'UNKNOWN',
});

// ── Temporal Resolution (Upstream Data Cadence) ──────────────────────────────
// How often the upstream provider produces new data.
// This is NOT the Worldview polling interval (that's runtimeConfig.pollIntervalMs).
export const TemporalResolution = Object.freeze({
  EVENT_DRIVEN: 'EVENT_DRIVEN',
  SECONDS: 'SECONDS',
  MINUTES: 'MINUTES',
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
  STATIC: 'STATIC',
  ON_DEMAND: 'ON_DEMAND',
  UNKNOWN: 'UNKNOWN',
});

// ── Authentication Type ──────────────────────────────────────────────────────
// Describes what kind of auth the provider requires.
// NEVER stores actual secrets — only the type and a secretRef name.
export const AuthType = Object.freeze({
  PUBLIC: 'PUBLIC',
  API_KEY: 'API_KEY',
  OAUTH: 'OAUTH',
  TOKEN: 'TOKEN',
  CERTIFICATE: 'CERTIFICATE',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',
});

// ── License & Access ─────────────────────────────────────────────────────────
export const LicenseStatus = Object.freeze({
  VERIFIED: 'VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  RESTRICTED: 'RESTRICTED',
  UNKNOWN: 'UNKNOWN',
});

export const AccessType = Object.freeze({
  OPEN: 'OPEN',
  RESTRICTED: 'RESTRICTED',
  COMMERCIAL: 'COMMERCIAL',
  GOVERNMENT: 'GOVERNMENT',
  UNKNOWN: 'UNKNOWN',
});

// ── Capability Status ────────────────────────────────────────────────────────
// Reflects ACTUAL runtime connectivity, not mere definition existence.
export const CapabilityStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',       // ≥1 connected, enabled, healthy provider
  PARTIAL: 'PARTIAL',           // Connected but incomplete coverage or degraded
  PLANNED: 'PLANNED',           // Only planned (not connected) providers exist
  UNAVAILABLE: 'UNAVAILABLE',   // No providers registered for this capability
});

// ── Provider Ownership ───────────────────────────────────────────────────────
// Configuration metadata declaring which mode owns the subscription.
// Enforced at runtime by ProviderManager to prevent duplicate polling.
export const ProviderOwnership = Object.freeze({
  WORLD: 'WORLD',
  CRISIS: 'CRISIS',
  SHARED: 'SHARED',
});

// ── Failure Classification ───────────────────────────────────────────────────
// Used by retry policy to determine appropriate response to failures.
export const FailureType = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH_FAILURE: 'AUTH_FAILURE',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  TEMPORARY: 'TEMPORARY',
  UNKNOWN: 'UNKNOWN',
});

// ── Provider Class ───────────────────────────────────────────────────────────
// Classification of provider interaction model.
// EVENT_PROVIDER / WARNING_PROVIDER / OBSERVATION_PROVIDER produce CanonicalEvents.
// EXPOSURE_PROVIDER / GEOSPATIAL_PROVIDER / VISUALIZATION_PROVIDER provide query-based or baseline data.
export const ProviderClass = Object.freeze({
  EVENT_PROVIDER: 'EVENT_PROVIDER',
  WARNING_PROVIDER: 'WARNING_PROVIDER',
  OBSERVATION_PROVIDER: 'OBSERVATION_PROVIDER',
  EXPOSURE_PROVIDER: 'EXPOSURE_PROVIDER',
  GEOSPATIAL_PROVIDER: 'GEOSPATIAL_PROVIDER',
  VISUALIZATION_PROVIDER: 'VISUALIZATION_PROVIDER',
});

// ── Lifecycle State ──────────────────────────────────────────────────────────
// Standard lifecycle states for provider contracts.
// ProviderManager (sole runtime authority) drives transitions.
export const LifecycleState = Object.freeze({
  UNINITIALIZED: 'UNINITIALIZED',
  INITIALIZED: 'INITIALIZED',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
});
