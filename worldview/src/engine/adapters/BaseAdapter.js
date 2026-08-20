import { SourceMode } from '../event/types.js';
import { validateCanonicalEvent } from '../event/validator.js';

/**
 * BaseAdapter: Contract and utility foundation for all Worldview provider adapters.
 */
export class BaseAdapter {
  /**
   * @param {string} sourceName - Provider source identifier
   * @param {string} [endpoint] - Upstream endpoint/product name
   */
  constructor(sourceName, endpoint = 'default') {
    if (!sourceName) throw new Error('BaseAdapter requires a sourceName');
    this.sourceName = sourceName;
    this.endpoint = endpoint;
    this.version = '1.0';
  }

  /**
   * Normalizes raw upstream payload into an array of CanonicalEvent objects.
   * Must be overridden by subclasses.
   *
   * @param {any} _rawData - Raw upstream provider payload
   * @param {object} [_context={}] - Optional contextual metadata (e.g. region, timestamp)
   * @returns {Array<object>} Array of CanonicalEvent objects
   */
  normalize() {
    throw new Error(`normalize() not implemented on ${this.constructor.name}`);
  }

  /**
   * Safe execution wrapper that catches errors and guarantees empty array on provider failure.
   *
   * @param {any} rawData
   * @param {object} [context={}]
   * @returns {{ events: Array<object>, error: string|null, count: number }}
   */
  safeNormalize(rawData, context = {}) {
    try {
      if (rawData === null || rawData === undefined) {
        return { events: [], error: null, count: 0 };
      }
      const events = this.normalize(rawData, context);
      if (!Array.isArray(events)) {
        return { events: [], error: 'Adapter returned non-array payload', count: 0 };
      }

      // Filter and validate events
      const validEvents = [];
      for (const ev of events) {
        const { valid, errors } = validateCanonicalEvent(ev);
        if (valid) {
          validEvents.push(ev);
        } else {
          console.warn(`[${this.sourceName}Adapter] Dropped invalid event ${ev?.id}: ${errors.join(', ')}`);
        }
      }

      return { events: validEvents, error: null, count: validEvents.length };
    } catch (err) {
      console.error(`[${this.sourceName}Adapter] Normalization error:`, err.message);
      return { events: [], error: err.message, count: 0 };
    }
  }

  /**
   * Unit Normalizers
   */
  static knotsToMps(knots) {
    if (typeof knots !== 'number' || isNaN(knots)) return 0;
    return Math.round(knots * 0.514444 * 100) / 100;
  }

  static kmhToMps(kmh) {
    if (typeof kmh !== 'number' || isNaN(kmh)) return 0;
    return Math.round((kmh / 3.6) * 100) / 100;
  }

  static feetToMeters(feet) {
    if (typeof feet !== 'number' || isNaN(feet)) return 0;
    return Math.round(feet * 0.3048);
  }

  static fahrenheitToCelsius(f) {
    if (typeof f !== 'number' || isNaN(f)) return 0;
    return Math.round(((f - 32) * (5 / 9)) * 10) / 10;
  }
}
