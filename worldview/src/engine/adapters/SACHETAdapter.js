/**
 * Worldview — SACHET (NDMA CAP 1.2 Alert System) Provider Adapter
 *
 * Implements full normalization for official Indian disaster alerts in OASIS CAP 1.2 format.
 *
 * Design Invariants:
 *   - An official warning is NOT Worldview crisis detection.
 *   - Preserves all CAP 1.2 fields without discarding severity, certainty, or instructions.
 *   - Flagged `isOfficial: true` with `authority: 'NDMA/SACHET'`.
 *   - Geometry (polygon / circle / point) preserved.
 */

import { BaseAdapter } from './BaseAdapter.js';
import { EventCategory, EventType, SourceMode } from '../event/types.js';
import { createCanonicalEvent } from '../event/CanonicalEvent.js';

export class SACHETAdapter extends BaseAdapter {
  constructor() {
    super('SACHET', 'https://sachet.ndma.gov.in/cap/v1/alerts');
  }

  /**
   * Normalizes raw SACHET CAP JSON / Object alert feeds into CanonicalEvents.
   *
   * @param {object|Array} rawData
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    if (!rawData) return [];

    const alerts = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData.alerts)
        ? rawData.alerts
        : Array.isArray(rawData.items)
          ? rawData.items
          : [rawData];

    const events = [];
    const sourceMode = context.sourceMode || SourceMode.LIVE;

    for (let i = 0; i < alerts.length; i++) {
      const alt = alerts[i];
      if (!alt || typeof alt !== 'object') continue;

      // Extract CAP info block (either root or alt.info)
      const info = alt.info || alt;

      const identifier = String(alt.identifier || alt.id || `sachet_${i}`);
      const sender = alt.sender || 'NDMA/SACHET';
      const sent = alt.sent || alt.timestamp || new Date().toISOString();
      const status = alt.status || 'Actual'; // Actual, Exercise, Test, Draft
      const msgType = alt.msgType || 'Alert'; // Alert, Update, Cancel, Ack, Error
      const scope = alt.scope || 'Public';

      // CAP info attributes
      const category = info.category || 'Met'; // Geo, Met, Safety, Security, Rescue, Fire, Health, Env, Transport, Infra, Other
      const eventName = info.event || 'Disaster Alert';
      const urgency = info.urgency || 'Immediate'; // Immediate, Expected, Future, Past, Unknown
      const severity = String(info.severity || 'Severe').toUpperCase(); // Extreme, Severe, Moderate, Minor, Unknown
      const certainty = info.certainty || 'Observed'; // Observed, Likely, Possible, Unlikely, Unknown

      const headline = info.headline || `${severity} Alert: ${eventName}`;
      const description = info.description || '';
      const instruction = info.instruction || '';
      const effective = info.effective || sent;
      const expires = info.expires || new Date(Date.now() + 86400000).toISOString();

      // Spatial resolution
      let lat = null;
      let lon = null;
      let geometry = null;
      let areaDesc = 'India Regional Alert Area';

      if (info.area) {
        const area = Array.isArray(info.area) ? info.area[0] : info.area;
        areaDesc = area.areaDesc || areaDesc;

        if (area.circle) {
          // Circle format: "lat,lon radius_km"
          const parts = String(area.circle).trim().split(/[\s,]+/);
          if (parts.length >= 2) {
            lat = Number(parts[0]);
            lon = Number(parts[1]);
          }
        } else if (area.polygon) {
          // Polygon format: "lat1,lon1 lat2,lon2 ..."
          const coordPairs = String(area.polygon).trim().split(/\s+/);
          const coords = [];
          for (const pair of coordPairs) {
            const [pLat, pLon] = pair.split(',').map(Number);
            if (!isNaN(pLat) && !isNaN(pLon)) {
              coords.push([pLon, pLat]); // GeoJSON is [lon, lat]
            }
          }
          if (coords.length >= 3) {
            // Close polygon if not closed
            if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
              coords.push([...coords[0]]);
            }
            geometry = { type: 'Polygon', coordinates: [coords] };
            lat = coords[0][1];
            lon = coords[0][0];
          }
        } else if (area.latitude !== undefined && area.longitude !== undefined) {
          lat = Number(area.latitude);
          lon = Number(area.longitude);
        }
      }

      // Fallback coordinates from root alert if area didn't specify
      if (lat === null || lon === null) {
        lat = Number(alt.latitude ?? alt.lat ?? 20.5937); // Default India center if purely national
        lon = Number(alt.longitude ?? alt.lon ?? 78.9629);
      }

      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      const ev = createCanonicalEvent({
        id: `sachet_alert_${identifier}`,
        source: 'SACHET',
        sourceMode,
        type: EventType.OFFICIAL_WARNING,
        category: EventCategory.HAZARD,
        observedAt: sent,
        receivedAt: new Date().toISOString(),
        location: {
          lat,
          lon,
          name: areaDesc,
        },
        geometry: geometry || {
          type: 'Point',
          coordinates: [lon, lat],
        },
        confidence: certainty === 'Observed' ? 1.0 : certainty === 'Likely' ? 0.9 : 0.8,
        maxAgeMs: 86400000, // 24 hours default alert freshness
        provenance: {
          source: 'SACHET',
          providerEventId: identifier,
          providerEndpoint: this.endpoint,
          version: this.version,
          isOfficial: true,
          authority: 'National Disaster Management Authority (NDMA)',
          sender,
          capVersion: '1.2',
          msgType,
          status,
          scope,
          validUntil: expires,
        },
        payload: {
          identifier,
          sender,
          capCategory: category,
          event: eventName,
          urgency,
          severity,
          certainty,
          headline,
          description,
          instruction,
          areaDesc,
          effective,
          expires,
          isOfficialWarning: true,
        },
      });

      events.push(ev);
    }

    return events;
  }
}
