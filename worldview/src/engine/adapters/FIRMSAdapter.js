/**
 * Worldview — NASA FIRMS (Fire Information for Resource Management System) Provider Adapter
 *
 * Implements normalization for VIIRS and MODIS near real-time active fire & thermal anomaly products.
 *
 * Design Invariants:
 *   - Emits raw FIRE_OBSERVATION (WILDFIRE_HOTSPOT) records, NOT separate crisis incidents.
 *   - Spatial and temporal clustering belongs to the downstream FusionEngine.
 *   - Preserves Fire Radiative Power (FRP), satellite, instrument, confidence, and brightness.
 */

import { BaseAdapter } from './BaseAdapter.js';
import { EventCategory, EventType, SourceMode } from '../event/types.js';
import { createCanonicalEvent } from '../event/CanonicalEvent.js';

export class FIRMSAdapter extends BaseAdapter {
  constructor() {
    super('NASA_FIRMS', 'https://firms.modaps.eosdis.nasa.gov/api/area/');
  }

  /**
   * Normalizes raw NASA FIRMS JSON / CSV / FeatureCollection fire hotspots into CanonicalEvents.
   *
   * @param {object|Array} rawData
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    if (!rawData) return [];

    let hotspots = [];
    if (rawData.type === 'FeatureCollection' && Array.isArray(rawData.features)) {
      hotspots = rawData.features;
    } else if (Array.isArray(rawData)) {
      hotspots = rawData;
    } else if (Array.isArray(rawData.hotspots)) {
      hotspots = rawData.hotspots;
    } else if (Array.isArray(rawData.data)) {
      hotspots = rawData.data;
    } else {
      hotspots = [rawData];
    }

    const events = [];
    const sourceMode = context.sourceMode || SourceMode.LIVE;

    for (let i = 0; i < hotspots.length; i++) {
      const h = hotspots[i];
      if (!h || typeof h !== 'object') continue;

      let lat = null;
      let lon = null;
      const props = h.properties || h;

      if (h.geometry && Array.isArray(h.geometry.coordinates)) {
        lon = Number(h.geometry.coordinates[0]);
        lat = Number(h.geometry.coordinates[1]);
      } else {
        lat = Number(props.latitude ?? props.lat);
        lon = Number(props.longitude ?? props.lon);
      }

      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      // Time resolution
      let observedAt = props.acq_date ? `${props.acq_date}T${props.acq_time ? props.acq_time.padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2:00Z') : '00:00:00Z'}` : (props.timestamp || new Date().toISOString());

      // Validate observedAt date string
      if (isNaN(new Date(observedAt).getTime())) {
        observedAt = new Date().toISOString();
      }

      const satellite = props.satellite || props.sat || 'VIIRS_NOAA20';
      const instrument = props.instrument || (satellite.includes('MODIS') ? 'MODIS' : 'VIIRS');
      const frp = props.frp !== undefined ? Number(props.frp) : null;
      const brightness = props.brightness !== undefined ? Number(props.brightness) : props.bright_ti4 !== undefined ? Number(props.bright_ti4) : null;
      const confidence = props.confidence !== undefined ? String(props.confidence) : 'nominal';
      const daynight = props.daynight || props.day_night || 'D';

      const numericConfidence =
        confidence === 'high' || confidence === 'h' ? 0.95 :
        confidence === 'nominal' || confidence === 'n' ? 0.80 :
        confidence === 'low' || confidence === 'l' ? 0.50 :
        !isNaN(Number(confidence)) ? Math.max(0, Math.min(1, Number(confidence) / 100)) : 0.80;

      const detectionId = `firms_${satellite.toLowerCase()}_${lat.toFixed(3)}_${lon.toFixed(3)}_${new Date(observedAt).getTime()}`;

      const ev = createCanonicalEvent({
        id: detectionId,
        source: 'NASA_FIRMS',
        sourceMode,
        type: EventType.WILDFIRE_HOTSPOT,
        category: EventCategory.HAZARD,
        observedAt,
        receivedAt: new Date().toISOString(),
        location: {
          lat,
          lon,
          name: `Thermal Hotspot (${instrument}/${satellite})`,
        },
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        confidence: numericConfidence,
        maxAgeMs: 43200000, // 12 hours hotspot freshness
        provenance: {
          source: 'NASA_FIRMS',
          providerEventId: detectionId,
          providerEndpoint: this.endpoint,
          version: this.version,
          satellite,
          instrument,
          frpMW: frp,
          brightnessKelvin: brightness,
          confidenceRaw: confidence,
          daynight,
        },
        payload: {
          satellite,
          instrument,
          frpMW: frp,
          brightnessKelvin: brightness,
          confidenceText: confidence,
          daynight,
          scan: props.scan ? Number(props.scan) : null,
          track: props.track ? Number(props.track) : null,
          acqDate: props.acq_date || null,
          acqTime: props.acq_time || null,
        },
      });

      events.push(ev);
    }

    return events;
  }
}
