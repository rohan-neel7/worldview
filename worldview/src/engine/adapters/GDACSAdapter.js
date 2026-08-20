/**
 * Worldview — GDACS (Global Disaster Alert and Coordination System) Provider Adapter
 *
 * Implements normalization for GDACS multi-hazard disaster alerts and assessments:
 *   - Earthquakes (EQ)
 *   - Tropical Cyclones (TC)
 *   - Floods (FL)
 *   - Volcanoes (VO)
 *   - Wildfires (WF)
 *
 * Design Invariants:
 *   - GDACS and USGS observations coexist independently (Fusion determines correlation)
 *   - Preserves alert level (Green/Orange/Red), population exposed estimate, event ID
 *   - Never overwrites USGS with GDACS or GDACS with USGS
 */

import { BaseAdapter } from './BaseAdapter.js';
import { EventCategory, EventType, SourceMode } from '../event/types.js';
import { createCanonicalEvent } from '../event/CanonicalEvent.js';

// Map GDACS event types to Worldview canonical EventTypes
const GDACS_TYPE_MAP = {
  EQ: EventType.EARTHQUAKE,
  EARTHQUAKE: EventType.EARTHQUAKE,
  TC: EventType.CYCLONE,
  CYCLONE: EventType.CYCLONE,
  TROPICALCYCLONE: EventType.CYCLONE,
  FL: EventType.FLOOD_SIGNAL,
  FLOOD: EventType.FLOOD_SIGNAL,
  WF: EventType.WILDFIRE_HOTSPOT,
  WILDFIRE: EventType.WILDFIRE_HOTSPOT,
  VO: EventType.GENERIC_OBSERVATION,
  VOLCANO: EventType.GENERIC_OBSERVATION,
  DR: EventType.GENERIC_OBSERVATION,
  DROUGHT: EventType.GENERIC_OBSERVATION,
};

export class GDACSAdapter extends BaseAdapter {
  constructor() {
    super('GDACS', 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH');
  }

  /**
   * Normalizes raw GDACS GeoJSON or JSON event list into CanonicalEvents.
   *
   * @param {object|Array} rawData
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    if (!rawData) return [];

    let items = [];
    if (Array.isArray(rawData.features)) {
      items = rawData.features;
    } else if (Array.isArray(rawData)) {
      items = rawData;
    } else if (Array.isArray(rawData.events)) {
      items = rawData.events;
    } else if (Array.isArray(rawData.items)) {
      items = rawData.items;
    } else {
      items = [rawData];
    }

    const events = [];
    const sourceMode = context.sourceMode || SourceMode.LIVE;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') continue;

      let lat = null;
      let lon = null;
      let depthKm = null;
      let props = item.properties || item;
      let geometry = item.geometry || null;

      // Extract coordinates
      if (geometry && geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
        lon = Number(geometry.coordinates[0]);
        lat = Number(geometry.coordinates[1]);
        if (geometry.coordinates.length > 2) {
          depthKm = Number(geometry.coordinates[2]);
        }
      } else {
        lat = Number(props.latitude ?? props.lat ?? props.centroid_lat);
        lon = Number(props.longitude ?? props.lon ?? props.centroid_lon);
      }

      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      const eventId = String(props.eventid || props.id || props.event_id || `gdacs_${i}`);
      const rawType = String(props.eventtype || props.type || 'EQ').toUpperCase();
      const eventType = GDACS_TYPE_MAP[rawType] || EventType.GENERIC_OBSERVATION;
      const eventName = props.name || props.eventname || props.title || `GDACS ${rawType} Event`;
      const alertLevel = String(props.alertlevel || props.alert_level || 'Green').toUpperCase(); // Green, Orange, Red
      const alertScore = props.alertscore ? Number(props.alertscore) : null;
      const eventTime = props.fromdate || props.eventdate || props.timestamp || new Date().toISOString();
      const country = props.country || props.affectedcountries || 'International';
      const populationExposed = props.population ? Number(props.population) : props.pop_affected ? Number(props.pop_affected) : null;
      const magnitude = props.magnitude ? Number(props.magnitude) : props.severity ? Number(props.severity) : null;

      const ev = createCanonicalEvent({
        id: `gdacs_${rawType.toLowerCase()}_${eventId}`,
        source: 'GDACS',
        sourceMode,
        type: eventType,
        category: EventCategory.HAZARD,
        observedAt: eventTime,
        receivedAt: new Date().toISOString(),
        location: {
          lat,
          lon,
          depthKm: depthKm !== null && !isNaN(depthKm) ? depthKm : undefined,
          name: `${eventName} (${country})`,
        },
        geometry: geometry || {
          type: 'Point',
          coordinates: [lon, lat],
        },
        confidence: alertLevel === 'RED' ? 0.98 : alertLevel === 'ORANGE' ? 0.90 : 0.80,
        maxAgeMs: 86400000, // 24 hours
        provenance: {
          source: 'GDACS',
          providerEventId: eventId,
          providerEndpoint: this.endpoint,
          version: this.version,
          alertLevel,
          alertScore,
          organization: 'UN OCHA / European Commission JRC',
          country,
        },
        payload: {
          gdacsEventId: eventId,
          gdacsEventType: rawType,
          eventName,
          alertLevel, // GREEN, ORANGE, RED
          alertScore,
          country,
          magnitude,
          depthKm,
          populationExposed,
          url: props.url || props.link || `https://www.gdacs.org/report.aspx?eventid=${eventId}&eventtype=${rawType}`,
        },
      });

      events.push(ev);
    }

    return events;
  }
}
