import { BaseAdapter } from './BaseAdapter.js';
import { createMovingEntityEvent } from '../event/CanonicalEvent.js';
import { EventType, SourceMode } from '../event/types.js';

export class CelesTrakAdapter extends BaseAdapter {
  constructor() {
    super('CelesTrak', 'celestrak.org/NORAD/elements/gp.php');
  }

  /**
   * @param {Array|object} rawData - Propagated satellite records
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    const sourceMode = context.sourceMode || SourceMode.LIVE;
    const receivedAt = context.receivedAt || new Date().toISOString();
    const processedAt = new Date().toISOString();

    let items = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && typeof rawData === 'object') {
      items = [rawData];
    }

    const events = [];

    for (const sat of items) {
      if (!sat) continue;

      const name = sat.name || sat.satName || 'UNKNOWN_SAT';
      const lat = sat.lat !== undefined ? sat.lat : sat.latitude;
      const lon = sat.lon !== undefined ? sat.lon : sat.longitude;
      // If altitude is under 100000, assume it was in km and convert to meters
      let altMeters = sat.alt !== undefined ? sat.alt : (sat.altitude || 500000);
      if (altMeters < 10000) {
        altMeters = altMeters * 1000;
      }

      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      const observedAt = sat.timestamp ? new Date(sat.timestamp).toISOString() : new Date().toISOString();
      const noradId = sat.noradId || sat.id || name.replace(/\s+/g, '_');

      const event = createMovingEntityEvent({
        id: `celestrak:${noradId}:${observedAt.slice(0, 16)}`,
        source: this.sourceName,
        sourceMode,
        type: EventType.SATELLITE,
        observedAt,
        receivedAt,
        processedAt,
        location: {
          lat: Number(lat.toFixed(5)),
          lon: Number(lon.toFixed(5)),
          altMeters: Number(altMeters.toFixed(1)),
        },
        confidence: 0.99, // Orbital physics deterministic propagation
        maxAgeMs: 120 * 1000, // 2 min
        provenance: {
          providerEventId: noradId,
          providerEndpoint: this.endpoint,
          version: this.version,
          originalRef: `NORAD:${noradId}`,
        },
        payload: {
          satName: name,
          noradId,
          altitudeMeters: Number(altMeters.toFixed(1)),
          tle1: sat.tle1 || null,
          tle2: sat.tle2 || null,
          entityType: 'SATELLITE',
        },
      });

      events.push(event);
    }

    return events;
  }
}
