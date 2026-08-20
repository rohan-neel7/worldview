import { BaseAdapter } from './BaseAdapter.js';
import { createMovingEntityEvent } from '../event/CanonicalEvent.js';
import { EventType, SourceMode } from '../event/types.js';

export class AISStreamAdapter extends BaseAdapter {
  constructor() {
    super('AISStream', 'stream.aisstream.io/v0/stream');
  }

  /**
   * @param {object|Array} rawData - Vessels list or API response { ships: [...] }
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
    } else if (rawData && Array.isArray(rawData.ships)) {
      items = rawData.ships;
    } else if (rawData && typeof rawData === 'object') {
      items = [rawData];
    }

    const events = [];

    for (const v of items) {
      if (!v) continue;

      const mmsi = v.mmsi ? String(v.mmsi).trim() : (v.id ? String(v.id).trim() : null);
      const name = v.name ? String(v.name).trim() : mmsi || 'UNKNOWN_VESSEL';
      const lat = v.lat !== undefined ? v.lat : v.latitude;
      const lon = v.lon !== undefined ? v.lon : v.longitude;
      const speedKnots = typeof v.speed === 'number' ? v.speed : 0;
      const speedMps = BaseAdapter.knotsToMps(speedKnots);
      const headingDeg = typeof v.heading === 'number' ? v.heading : (v.course || 0);

      if (!mmsi || typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      const observedAt = v.lastUpdate ? new Date(v.lastUpdate).toISOString() : new Date().toISOString();

      const event = createMovingEntityEvent({
        id: `ais:${mmsi}:${observedAt.slice(0, 16)}`,
        source: this.sourceName,
        sourceMode,
        type: EventType.VESSEL,
        observedAt,
        receivedAt,
        processedAt,
        location: {
          lat: Number(lat.toFixed(5)),
          lon: Number(lon.toFixed(5)),
          altMeters: 0,
        },
        confidence: 0.95,
        maxAgeMs: 300 * 1000, // 5 min
        provenance: {
          providerEventId: mmsi,
          providerEndpoint: this.endpoint,
          version: this.version,
          originalRef: `MMSI:${mmsi}`,
        },
        payload: {
          mmsi,
          name,
          shipType: v.shipType || 'Unknown',
          speedMps,
          speedKnots,
          headingDeg,
          destination: v.destination || '--',
          callsign: v.callsign || '--',
          navStatus: v.navStatus || null,
          entityType: 'VESSEL',
        },
      });

      events.push(event);
    }

    return events;
  }
}
