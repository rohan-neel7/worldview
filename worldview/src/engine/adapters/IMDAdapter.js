/**
 * Worldview — IMD (India Meteorological Department) Provider Adapters
 *
 * Implements semantically separated adapters for IMD products:
 *   - IMDWeatherAdapter: Station-level weather & rainfall observations
 *   - IMDWarningAdapter: District/State color-coded warnings & nowcasts
 *   - IMDCycloneAdapter: Cyclone bulletins, tracks, and wind radii
 *
 * Design Invariants:
 *   - Rainfall / weather observation alone ≠ CRISIS (enters pipeline for fusion)
 *   - Official warnings are flagged `isOfficial: true` with `authority: 'IMD'`
 *   - Never claims Worldview inference as an official warning
 *   - All coordinate validation, timestamp validation, and units conversion applied
 */

import { BaseAdapter } from './BaseAdapter.js';
import { EventCategory, EventType, SourceMode } from '../event/types.js';
import { createCanonicalEvent } from '../event/CanonicalEvent.js';

/**
 * 1. IMD Weather & Rainfall Observation Adapter
 */
export class IMDWeatherAdapter extends BaseAdapter {
  constructor() {
    super('IMD', 'https://api.imd.gov.in/weather/v1/observations');
  }

  /**
   * Normalizes raw IMD weather/rainfall observations into CanonicalEvents.
   *
   * @param {object|Array} rawData - Array of station records or object with stations
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    if (!rawData) return [];

    const stations = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData.stations)
        ? rawData.stations
        : Array.isArray(rawData.data)
          ? rawData.data
          : [rawData];

    const events = [];
    const sourceMode = context.sourceMode || SourceMode.LIVE;

    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      if (!st || typeof st !== 'object') continue;

      const lat = Number(st.latitude ?? st.lat);
      const lon = Number(st.longitude ?? st.lon);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      const stationId = String(st.station_id || st.id || `imd_stn_${i}`);
      const stationName = st.station_name || st.name || st.city || 'IMD Weather Station';
      const observedAt = st.timestamp || st.time || st.observed_at || new Date().toISOString();

      const tempC = st.temp_c !== undefined ? Number(st.temp_c) : st.temperature !== undefined ? Number(st.temperature) : null;
      const humidity = st.humidity !== undefined ? Number(st.humidity) : st.rh !== undefined ? Number(st.rh) : null;
      const pressureHpa = st.pressure_hpa !== undefined ? Number(st.pressure_hpa) : st.pressure !== undefined ? Number(st.pressure) : null;
      
      // Wind speed conversion if needed
      let windSpeedMps = null;
      if (st.wind_speed_mps !== undefined) {
        windSpeedMps = Number(st.wind_speed_mps);
      } else if (st.wind_speed_kmh !== undefined || st.wind_speed !== undefined) {
        windSpeedMps = BaseAdapter.kmhToMps(Number(st.wind_speed_kmh ?? st.wind_speed));
      }

      const windDirectionDeg = st.wind_direction_deg !== undefined ? Number(st.wind_direction_deg) : st.wind_direction !== undefined ? Number(st.wind_direction) : null;
      const rainfallMm = st.rainfall_24h_mm !== undefined ? Number(st.rainfall_24h_mm) : st.rainfall_mm !== undefined ? Number(st.rainfall_mm) : st.rain !== undefined ? Number(st.rain) : 0;
      const rainfall1hMm = st.rainfall_1h_mm !== undefined ? Number(st.rainfall_1h_mm) : null;

      const ev = createCanonicalEvent({
        id: `imd_obs_${stationId}_${new Date(observedAt).getTime() || Date.now()}`,
        source: 'IMD',
        sourceMode,
        type: EventType.WEATHER,
        category: EventCategory.ENVIRONMENTAL,
        observedAt,
        receivedAt: new Date().toISOString(),
        location: {
          lat,
          lon,
          altMeters: st.altitude_m ? Number(st.altitude_m) : undefined,
        },
        confidence: 0.95,
        maxAgeMs: 3600000, // 1 hour expected freshness
        provenance: {
          source: 'IMD',
          providerEventId: stationId,
          providerEndpoint: this.endpoint,
          version: this.version,
          isOfficial: true,
          authority: 'India Meteorological Department',
          product: 'WEATHER_OBSERVATION',
        },
        payload: {
          stationId,
          stationName,
          temperatureC: tempC,
          relativeHumidity: humidity,
          pressureHpa,
          windSpeedMps,
          windDirectionDeg,
          rainfallMm,
          rainfall1hMm,
          weatherCondition: st.condition || st.weather_desc || 'Fair',
        },
      });

      events.push(ev);
    }

    return events;
  }
}

/**
 * 2. IMD Official Warnings & Nowcasts Adapter
 */
export class IMDWarningAdapter extends BaseAdapter {
  constructor() {
    super('IMD', 'https://api.imd.gov.in/warnings/v1/district');
  }

  /**
   * Normalizes raw IMD warnings into CanonicalEvents.
   *
   * @param {object|Array} rawData
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    if (!rawData) return [];

    const warnings = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData.warnings)
        ? rawData.warnings
        : Array.isArray(rawData.alerts)
          ? rawData.alerts
          : [rawData];

    const events = [];
    const sourceMode = context.sourceMode || SourceMode.LIVE;

    for (let i = 0; i < warnings.length; i++) {
      const w = warnings[i];
      if (!w || typeof w !== 'object') continue;

      const lat = Number(w.latitude ?? w.lat);
      const lon = Number(w.longitude ?? w.lon);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      const warningId = String(w.warning_id || w.id || `imd_warn_${i}`);
      const district = w.district || w.district_name || 'Regional';
      const state = w.state || w.state_name || 'India';
      const warningColor = String(w.color || w.warning_level || 'YELLOW').toUpperCase();
      const hazardType = w.hazard_type || w.type || 'SEVERE_WEATHER';
      const issuedAt = w.issued_at || w.timestamp || new Date().toISOString();
      const validUntil = w.valid_until || w.valid_to || new Date(Date.now() + 86400000).toISOString();

      const ev = createCanonicalEvent({
        id: `imd_warn_${warningId}`,
        source: 'IMD',
        sourceMode,
        type: EventType.OFFICIAL_WARNING,
        category: EventCategory.HAZARD,
        observedAt: issuedAt,
        receivedAt: new Date().toISOString(),
        location: {
          lat,
          lon,
          name: `${district}, ${state}`,
        },
        geometry: w.geometry || undefined,
        confidence: 1.0, // Official authority warning
        maxAgeMs: 86400000, // 24 hours
        provenance: {
          source: 'IMD',
          providerEventId: warningId,
          providerEndpoint: this.endpoint,
          version: this.version,
          isOfficial: true,
          authority: 'India Meteorological Department',
          product: 'DISTRICT_WARNING',
          validUntil,
        },
        payload: {
          warningId,
          district,
          state,
          warningColor, // RED, ORANGE, YELLOW, GREEN
          hazardType,
          severity: warningColor === 'RED' ? 'CRITICAL' : warningColor === 'ORANGE' ? 'HIGH' : 'MODERATE',
          headline: w.headline || `IMD ${warningColor} Alert for ${district}`,
          description: w.description || w.warning_text || '',
          instruction: w.instruction || w.action_suggested || '',
          validFrom: issuedAt,
          validTo: validUntil,
        },
      });

      events.push(ev);
    }

    return events;
  }
}

/**
 * 3. IMD Cyclone Track & Bulletins Adapter
 */
export class IMDCycloneAdapter extends BaseAdapter {
  constructor() {
    super('IMD', 'https://api.imd.gov.in/cyclone/v1/bulletins');
  }

  /**
   * Normalizes raw IMD cyclone tracking bulletins into CanonicalEvents.
   *
   * @param {object|Array} rawData
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    if (!rawData) return [];

    const cyclones = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData.cyclones)
        ? rawData.cyclones
        : [rawData];

    const events = [];
    const sourceMode = context.sourceMode || SourceMode.LIVE;

    for (let i = 0; i < cyclones.length; i++) {
      const cy = cyclones[i];
      if (!cy || typeof cy !== 'object') continue;

      const lat = Number(cy.latitude ?? cy.lat ?? cy.center_lat);
      const lon = Number(cy.longitude ?? cy.lon ?? cy.center_lon);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      const cycloneId = String(cy.cyclone_id || cy.id || `imd_cyc_${i}`);
      const cycloneName = cy.name || cy.cyclone_name || 'UNNAMED_CYCLONE';
      const stage = cy.stage || cy.intensity_grade || 'Cyclonic Storm';
      const observedAt = cy.timestamp || cy.observed_at || new Date().toISOString();

      const pressureHpa = cy.central_pressure_hpa ? Number(cy.central_pressure_hpa) : null;
      let maxWindMps = null;
      if (cy.max_sustained_wind_mps !== undefined) {
        maxWindMps = Number(cy.max_sustained_wind_mps);
      } else if (cy.max_sustained_wind_kmph !== undefined || cy.max_wind_kmph !== undefined) {
        maxWindMps = BaseAdapter.kmhToMps(Number(cy.max_sustained_wind_kmph ?? cy.max_wind_kmph));
      } else if (cy.max_wind_knots !== undefined) {
        maxWindMps = BaseAdapter.knotsToMps(Number(cy.max_wind_knots));
      }

      const track = Array.isArray(cy.forecast_track || cy.track)
        ? (cy.forecast_track || cy.track).map((pt) => ({
            lat: Number(pt.lat || pt.latitude),
            lon: Number(pt.lon || pt.longitude),
            time: pt.time || pt.timestamp,
            intensityKmph: pt.intensity_kmph ? Number(pt.intensity_kmph) : undefined,
          })).filter((pt) => !isNaN(pt.lat) && !isNaN(pt.lon))
        : [];

      const ev = createCanonicalEvent({
        id: `imd_cyclone_${cycloneId}`,
        source: 'IMD',
        sourceMode,
        type: EventType.CYCLONE,
        category: EventCategory.HAZARD,
        observedAt,
        receivedAt: new Date().toISOString(),
        location: {
          lat,
          lon,
          name: `${cycloneName} (${stage})`,
        },
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        confidence: 0.98,
        maxAgeMs: 21600000, // 6 hours (matches cyclone bulletin cadence)
        provenance: {
          source: 'IMD',
          providerEventId: cycloneId,
          providerEndpoint: this.endpoint,
          version: this.version,
          isOfficial: true,
          authority: 'India Meteorological Department (RSMC New Delhi)',
          product: 'CYCLONE_BULLETIN',
        },
        payload: {
          cycloneId,
          cycloneName,
          stage,
          centralPressureHpa: pressureHpa,
          maxSustainedWindMps: maxWindMps,
          movementSpeedKmph: cy.movement_speed_kmph ? Number(cy.movement_speed_kmph) : null,
          movementDirection: cy.movement_direction || null,
          forecastTrack: track,
          landfallForecast: cy.landfall_forecast || null,
        },
      });

      events.push(ev);
    }

    return events;
  }
}
