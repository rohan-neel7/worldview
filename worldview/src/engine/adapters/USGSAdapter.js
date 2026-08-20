import { BaseAdapter } from './BaseAdapter.js';
import { createHazardEvent } from '../event/CanonicalEvent.js';
import { EventType, SourceMode } from '../event/types.js';

export class USGSAdapter extends BaseAdapter {
  constructor() {
    super('USGS', 'earthquake.usgs.gov/summary/all_day.geojson');
  }

  /**
   * @param {object|Array} rawData - USGS GeoJSON object or features array
   * @param {object} [context={}] - e.g. { sourceMode: 'LIVE' }
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    const sourceMode = context.sourceMode || SourceMode.LIVE;
    const receivedAt = context.receivedAt || new Date().toISOString();
    const processedAt = new Date().toISOString();

    let features = [];
    if (Array.isArray(rawData)) {
      features = rawData;
    } else if (rawData && Array.isArray(rawData.features)) {
      features = rawData.features;
    } else if (rawData && typeof rawData === 'object' && rawData.id) {
      features = [rawData];
    }

    const events = [];

    for (const f of features) {
      if (!f) continue;

      // Handle both raw GeoJSON feature structure and simplified USGS hook objects
      let id, lon, lat, depthKm, magnitude, place, timeEpoch, alertLevel, tsunamiFlag, sig, status;

      if (f.geometry && Array.isArray(f.geometry.coordinates)) {
        // Standard USGS GeoJSON feature
        id = f.id || `usgs-${Math.random().toString(36).substring(2, 9)}`;
        [lon, lat, depthKm] = f.geometry.coordinates;
        const p = f.properties || {};
        magnitude = typeof p.mag === 'number' ? p.mag : 0;
        place = p.place || 'Unknown Location';
        timeEpoch = p.time || Date.now();
        alertLevel = p.alert || null;
        tsunamiFlag = p.tsunami || 0;
        sig = p.sig || 0;
        status = p.status || 'reviewed';
      } else if (f.latitude !== undefined || f.lat !== undefined) {
        // Pre-parsed or hook-processed object
        id = f.id || `usgs-${Math.random().toString(36).substring(2, 9)}`;
        lat = f.latitude !== undefined ? f.latitude : f.lat;
        lon = f.longitude !== undefined ? f.longitude : f.lon;
        depthKm = f.depth !== undefined ? f.depth : 10;
        magnitude = typeof f.magnitude === 'number' ? f.magnitude : 0;
        place = f.place || 'Unknown Location';
        timeEpoch = f.time ? new Date(f.time).getTime() : Date.now();
        alertLevel = f.alert || null;
        tsunamiFlag = f.tsunami || 0;
        sig = f.sig || 0;
        status = f.status || 'reviewed';
      } else {
        continue;
      }

      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      const observedAt = new Date(timeEpoch).toISOString();
      const confidence = status === 'reviewed' ? 0.98 : 0.85;

      const event = createHazardEvent({
        id: id.startsWith('usgs:') ? id : `usgs:${id}`,
        source: this.sourceName,
        sourceMode,
        type: EventType.EARTHQUAKE,
        observedAt,
        receivedAt,
        processedAt,
        location: {
          lat: Number(lat.toFixed(5)),
          lon: Number(lon.toFixed(5)),
          altMeters: 0,
          depthKm: Number((depthKm || 0).toFixed(2)),
        },
        confidence,
        maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
        provenance: {
          providerEventId: id,
          providerEndpoint: this.endpoint,
          version: this.version,
          originalRef: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
        },
        payload: {
          magnitude: Number(magnitude.toFixed(2)),
          depthKm: Number((depthKm || 0).toFixed(2)),
          place,
          significance: sig,
          alertLevel,
          tsunamiFlag: Boolean(tsunamiFlag),
          reviewStatus: status,
        },
      });

      events.push(event);
    }

    return events;
  }
}
