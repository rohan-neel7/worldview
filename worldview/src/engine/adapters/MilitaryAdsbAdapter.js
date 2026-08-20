import { BaseAdapter } from './BaseAdapter.js';
import { createMovingEntityEvent } from '../event/CanonicalEvent.js';
import { EventType, SourceMode } from '../event/types.js';

export class MilitaryAdsbAdapter extends BaseAdapter {
  constructor() {
    super('adsb.lol', 'api.adsb.lol/v2/mil');
  }

  /**
   * @param {object|Array} rawData
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
    } else if (rawData && Array.isArray(rawData.ac)) {
      items = rawData.ac;
    } else if (rawData && typeof rawData === 'object') {
      items = [rawData];
    }

    const events = [];

    for (const a of items) {
      if (!a) continue;

      const icao24 = a.hex || a.icao24 || null;
      const callsign = (a.flight || a.callsign || icao24 || 'MIL_AIRCRAFT').trim();
      const lat = a.lat !== undefined ? a.lat : a.latitude;
      const lon = a.lon !== undefined ? a.lon : a.longitude;
      const aircraftType = a.t || a.type || 'MILITARY';
      const altFeet = a.alt_baro !== undefined && a.alt_baro !== 'ground' ? Number(a.alt_baro) : (a.alt || 10000);
      const altMeters = BaseAdapter.feetToMeters(altFeet);
      const speedKnots = typeof a.gs === 'number' ? a.gs : (a.speed || 0);
      const speedMps = BaseAdapter.knotsToMps(speedKnots);
      const headingDeg = typeof a.track === 'number' ? a.track : (a.heading || 0);

      if (!icao24 || typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      const observedAt = a.now ? new Date(a.now * 1000).toISOString() : new Date().toISOString();

      const event = createMovingEntityEvent({
        id: `mil:${icao24}:${observedAt.slice(0, 16)}`,
        source: this.sourceName,
        sourceMode,
        type: EventType.AIRCRAFT,
        observedAt,
        receivedAt,
        processedAt,
        location: {
          lat: Number(lat.toFixed(5)),
          lon: Number(lon.toFixed(5)),
          altMeters,
        },
        confidence: 0.92,
        maxAgeMs: 60 * 1000,
        provenance: {
          providerEventId: icao24,
          providerEndpoint: this.endpoint,
          version: this.version,
          originalRef: `ICAO24:${icao24}`,
        },
        payload: {
          icao24,
          callsign,
          aircraftType,
          speedMps,
          speedKnots,
          headingDeg,
          altitudeMeters: altMeters,
          entityType: 'AIRCRAFT',
          military: true,
        },
      });

      events.push(event);
    }

    return events;
  }
}
