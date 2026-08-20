import { BaseAdapter } from './BaseAdapter.js';
import { createMovingEntityEvent } from '../event/CanonicalEvent.js';
import { EventType, SourceMode } from '../event/types.js';

export class OpenSkyAdapter extends BaseAdapter {
  constructor() {
    super('OpenSky', 'opensky-network.org/api/states/all');
  }

  /**
   * @param {object|Array} rawData - OpenSky response or flight objects array
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
    } else if (rawData && Array.isArray(rawData.states)) {
      items = rawData.states;
    } else if (rawData && typeof rawData === 'object') {
      items = [rawData];
    }

    const events = [];

    for (const item of items) {
      if (!item) continue;

      let icao24, callsign, country, lat, lon, altMeters, velocityMps, headingDeg, onGround, timePos;

      if (Array.isArray(item)) {
        // Raw OpenSky state vector array
        icao24 = item[0] ? String(item[0]).trim() : null;
        callsign = item[1] ? String(item[1]).trim() : icao24 || 'UNKNOWN';
        country = item[2] || 'Unknown';
        timePos = item[3] ? item[3] * 1000 : Date.now();
        lon = item[5];
        lat = item[6];
        altMeters = item[7] !== null && item[7] !== undefined ? item[7] : (item[13] || 10000);
        onGround = Boolean(item[8]);
        velocityMps = item[9] !== null && item[9] !== undefined ? item[9] : 0;
        headingDeg = item[10] !== null && item[10] !== undefined ? item[10] : 0;
      } else if (typeof item === 'object') {
        // Parsed flight object
        icao24 = item.icao24 || item.id || null;
        callsign = item.callsign || icao24 || 'UNKNOWN';
        country = item.country || 'Global';
        timePos = item.time ? new Date(item.time).getTime() : Date.now();
        lat = item.latitude !== undefined ? item.latitude : item.lat;
        lon = item.longitude !== undefined ? item.longitude : item.lon;
        altMeters = item.altitude !== undefined ? item.altitude : (item.alt || 10000);
        onGround = Boolean(item.onGround);
        velocityMps = item.velocity !== undefined ? item.velocity : 0;
        headingDeg = item.heading !== undefined ? item.heading : 0;
      } else {
        continue;
      }

      if (!icao24 || typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      const observedAt = new Date(timePos || Date.now()).toISOString();

      const event = createMovingEntityEvent({
        id: `opensky:${icao24}:${observedAt.slice(0, 16)}`,
        source: this.sourceName,
        sourceMode,
        type: EventType.AIRCRAFT,
        observedAt,
        receivedAt,
        processedAt,
        location: {
          lat: Number(lat.toFixed(5)),
          lon: Number(lon.toFixed(5)),
          altMeters: Number((altMeters || 0).toFixed(1)),
        },
        confidence: 0.95,
        maxAgeMs: 60 * 1000, // 60s
        provenance: {
          providerEventId: icao24,
          providerEndpoint: this.endpoint,
          version: this.version,
          originalRef: `ICAO24:${icao24}`,
        },
        payload: {
          icao24,
          callsign,
          country,
          speedMps: Number((velocityMps || 0).toFixed(1)),
          headingDeg: Number((headingDeg || 0).toFixed(1)),
          altitudeMeters: Number((altMeters || 0).toFixed(1)),
          onGround,
          entityType: 'AIRCRAFT',
          military: false,
        },
      });

      events.push(event);
    }

    return events;
  }
}
