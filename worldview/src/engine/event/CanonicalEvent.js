import { EventCategory, SourceMode } from './types.js';
import { computeFreshness } from './freshness.js';
import { validateCanonicalEvent } from './validator.js';

function safeToISOString(val, fallbackNow = true) {
  if (!val) return fallbackNow ? new Date().toISOString() : null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toISOString();
}

/**
 * Creates a Canonical Event object following the common envelope + semantic payload architecture.
 *
 * @param {object} params
 * @param {string} params.id - Unique event identifier
 * @param {string} params.source - Data provider source identifier (e.g. 'USGS', 'OpenSky')
 * @param {string} [params.sourceMode=SourceMode.LIVE] - 'LIVE' | 'SIMULATED' | 'FIXTURE' | 'DERIVED'
 * @param {string} params.type - EventType identifier (e.g. 'EARTHQUAKE', 'AIRCRAFT')
 * @param {string} params.category - EventCategory identifier ('HAZARD', 'MOVING_ENTITY', etc.)
 * @param {string|number|Date} params.observedAt - Observation timestamp
 * @param {string|number|Date} [params.receivedAt] - Ingestion timestamp
 * @param {string|number|Date} [params.processedAt] - Normalization timestamp
 * @param {{ lat: number, lon: number, altMeters?: number, depthKm?: number }} [params.location] - WGS84 location
 * @param {{ type: string, coordinates: Array }} [params.geometry] - GeoJSON geometry
 * @param {object} [params.provenance] - Data lineage and source metadata
 * @param {number} [params.confidence=1.0] - Measurement confidence (0.0 to 1.0)
 * @param {number} [params.maxAgeMs=300000] - Freshness duration in ms
 * @param {object} [params.payload={}] - Semantic payload specific to event category
 * @param {boolean} [params.strict=false] - If true, throws error on validation failure
 * @returns {object} The canonical event object
 */
export function createCanonicalEvent({
  id,
  source,
  sourceMode = SourceMode.LIVE,
  type,
  category,
  observedAt,
  receivedAt = new Date().toISOString(),
  processedAt = new Date().toISOString(),
  location = null,
  geometry = null,
  provenance = {},
  confidence = 1.0,
  maxAgeMs = 300000,
  payload = {},
  strict = false,
}) {
  const normObservedAt = safeToISOString(observedAt, true);
  const normReceivedAt = safeToISOString(receivedAt, true);
  const normProcessedAt = safeToISOString(processedAt, true);

  // Compute GeoJSON geometry from location if not explicitly provided
  let finalGeometry = geometry;
  if (!finalGeometry && location && typeof location.lat === 'number' && typeof location.lon === 'number') {
    finalGeometry = {
      type: 'Point',
      coordinates: [location.lon, location.lat],
    };
  }

  // Build provenance preserving custom fields for audit/validation
  const cleanProvenance = {
    source,
    sourceMode,
    observedAt: normObservedAt,
    receivedAt: normReceivedAt,
    processedAt: normProcessedAt,
    providerEventId: provenance.providerEventId || null,
    providerEndpoint: provenance.providerEndpoint || null,
    version: provenance.version || '1.0',
    originalRef: provenance.originalRef || null,
    ...provenance,
  };

  const freshness = computeFreshness(normObservedAt, normReceivedAt, maxAgeMs);

  const event = {
    id,
    source,
    sourceMode,
    type,
    category,
    observedAt: normObservedAt,
    receivedAt: normReceivedAt,
    processedAt: normProcessedAt,
    location,
    geometry: finalGeometry,
    provenance: cleanProvenance,
    confidence: Math.max(0.0, Math.min(1.0, typeof confidence === 'number' ? confidence : 1.0)),
    freshness,
    payload: payload || {},
  };

  if (strict) {
    const { valid, errors } = validateCanonicalEvent(event);
    if (!valid) {
      throw new Error(`CanonicalEvent validation failed: ${errors.join('; ')}`);
    }
  }

  return event;
}

/**
 * Creates a HazardEvent (e.g. Earthquake, Tsunami signal, Flood signal)
 */
export function createHazardEvent(params) {
  return createCanonicalEvent({
    ...params,
    category: EventCategory.HAZARD,
  });
}

/**
 * Creates an EnvironmentalObservation (e.g. Weather, Radar, Climate observation)
 */
export function createEnvironmentalObservation(params) {
  return createCanonicalEvent({
    ...params,
    category: EventCategory.ENVIRONMENTAL,
  });
}

/**
 * Creates a MovingEntityEvent (e.g. Aircraft, Satellite, Maritime Vessel)
 */
export function createMovingEntityEvent(params) {
  return createCanonicalEvent({
    ...params,
    category: EventCategory.MOVING_ENTITY,
  });
}

/**
 * Creates a Generic ObservationEvent (e.g. Sensor reading, Gauge level)
 */
export function createObservationEvent(params) {
  return createCanonicalEvent({
    ...params,
    category: EventCategory.OBSERVATION,
  });
}
