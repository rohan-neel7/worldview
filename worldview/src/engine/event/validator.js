import { EventCategory, SourceMode, FreshnessStatus } from './types.js';

const SENSITIVE_KEY_PATTERN = /api[_-]?key|token|secret|password|bearer|authorization|^auth$|^auth_/i;

/**
 * Validates a CanonicalEvent against structural, geospatial, and semantic rules.
 *
 * @param {object} event - The canonical event to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCanonicalEvent(event) {
  const errors = [];

  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['Event must be a non-null object'] };
  }

  // 1. Mandatory Envelope Identification
  if (!event.id || typeof event.id !== 'string' || event.id.trim() === '') {
    errors.push('Event "id" must be a non-empty string');
  }

  if (!event.source || typeof event.source !== 'string' || event.source.trim() === '') {
    errors.push('Event "source" must be a non-empty string');
  }

  if (!event.sourceMode || !Object.values(SourceMode).includes(event.sourceMode)) {
    errors.push(`Event "sourceMode" must be one of: ${Object.values(SourceMode).join(', ')}`);
  }

  if (!event.type || typeof event.type !== 'string' || event.type.trim() === '') {
    errors.push('Event "type" must be a non-empty string');
  }

  if (!event.category || !Object.values(EventCategory).includes(event.category)) {
    errors.push(`Event "category" must be one of: ${Object.values(EventCategory).join(', ')}`);
  }

  // 2. Spatial Validation
  if (event.location) {
    const { lat, lon, altMeters, depthKm } = event.location;

    if (typeof lat !== 'number' || isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) {
      errors.push(`Latitude must be a finite number between -90 and 90, got: ${lat}`);
    }

    if (typeof lon !== 'number' || isNaN(lon) || !isFinite(lon) || lon < -180 || lon > 180) {
      errors.push(`Longitude must be a finite number between -180 and 180, got: ${lon}`);
    }

    if (altMeters !== undefined && (typeof altMeters !== 'number' || isNaN(altMeters) || !isFinite(altMeters))) {
      errors.push(`altMeters must be a finite number, got: ${altMeters}`);
    }

    if (depthKm !== undefined && (typeof depthKm !== 'number' || isNaN(depthKm) || !isFinite(depthKm))) {
      errors.push(`depthKm must be a finite number, got: ${depthKm}`);
    }
  }

  // 3. Temporal Validation
  const validateTimestamp = (field, val) => {
    if (!val) {
      errors.push(`Event "${field}" is required`);
      return;
    }
    const epoch = new Date(val).getTime();
    if (isNaN(epoch)) {
      errors.push(`Event "${field}" is not a valid ISO timestamp: ${val}`);
    }
  };

  validateTimestamp('observedAt', event.observedAt);
  validateTimestamp('receivedAt', event.receivedAt);
  validateTimestamp('processedAt', event.processedAt);

  // 4. Provenance Validation
  if (!event.provenance || typeof event.provenance !== 'object') {
    errors.push('Event "provenance" must be an object');
  } else {
    // Check for exposed secrets
    const provKeys = Object.keys(event.provenance);
    for (const k of provKeys) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        errors.push(`Provenance must not contain sensitive credentials/keys: "${k}"`);
      }
    }
  }

  // 5. Confidence Validation
  if (typeof event.confidence !== 'number' || isNaN(event.confidence) || event.confidence < 0 || event.confidence > 1) {
    errors.push(`Confidence must be a number between 0.0 and 1.0, got: ${event.confidence}`);
  }

  // 6. Freshness Validation
  if (!event.freshness || typeof event.freshness !== 'object') {
    errors.push('Event "freshness" must be an object');
  } else if (!Object.values(FreshnessStatus).includes(event.freshness.status)) {
    errors.push(`Freshness status must be one of: ${Object.values(FreshnessStatus).join(', ')}`);
  }

  // 7. Payload Validation
  if (event.payload === null || event.payload === undefined || typeof event.payload !== 'object') {
    errors.push('Event "payload" must be a non-null object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
