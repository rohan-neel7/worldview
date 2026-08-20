/**
 * Worldview Disaster Intelligence — Anomaly Detection Engine
 *
 * Deterministic statistical and baseline anomaly detection layer.
 *
 * Adheres to Phase 6C Corrections #2 & #3:
 *   - Uses provider-defined, region-configurable, and climatological thresholds
 *     rather than unvalidated statistical 3-sigma models.
 *   - Documents source and rationale for every detected anomaly.
 */

import { AnomalyType, EventType, SeverityLevel } from '../../event/types.js';
import { ANOMALY_THRESHOLDS } from './anomalyRules.js';

export class AnomalyEngine {
  /**
   * @param {object} [customThresholds={}]
   */
  constructor(customThresholds = {}) {
    this.thresholds = { ...ANOMALY_THRESHOLDS, ...customThresholds };
  }

  /**
   * Detects anomalies across individual events or correlated observation clusters.
   *
   * @param {Array<object>} events - Normalized CanonicalEvents
   * @param {object} [context={}]
   * @returns {Array<object>} Detected structured anomaly objects
   */
  detect(events, context = {}) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const anomalies = [];
    const country = context.countryId || 'GLOBAL';

    for (const ev of events) {
      const eventAnomalies = this._detectEventAnomalies(ev, country);
      if (eventAnomalies.length > 0) {
        anomalies.push(...eventAnomalies);
      }
    }

    // Cluster-level anomaly detection (e.g. dense thermal hotspot clustering)
    const clusterAnomalies = this._detectClusterAnomalies(events);
    if (clusterAnomalies.length > 0) {
      anomalies.push(...clusterAnomalies);
    }

    return anomalies;
  }

  _detectEventAnomalies(ev, country) {
    const list = [];
    const payload = ev.payload || {};

    // 1. Rainfall Precipitation Anomaly (IMD thresholds for India, Global baseline otherwise)
    const rainfall24h = payload.rainfallMm ?? payload.rainfall_24h_mm ?? payload.precipitationMm;
    const rainfall1h = payload.rainfall1hMm ?? payload.rainfall_1h_mm;

    if (typeof rainfall24h === 'number' && rainfall24h > 0) {
      const imdThresh = this.thresholds.IMD_RAINFALL_24H;
      const globalThresh = this.thresholds.GLOBAL_RAINFALL_24H;
      const useImd = country === 'IN' || ev.source === 'IMD';

      const thresh = useImd ? imdThresh : globalThresh;

      if (rainfall24h >= thresh.EXTREMELY_HEAVY) {
        list.push({
          id: `anom_rain24_${ev.id}`,
          type: AnomalyType.POINT_ANOMALY,
          category: 'PRECIPITATION',
          observedValue: rainfall24h,
          unit: 'mm/24h',
          baselineThreshold: thresh.EXTREMELY_HEAVY,
          deviation: `+${(rainfall24h - thresh.EXTREMELY_HEAVY).toFixed(1)} mm above Extremely Heavy threshold`,
          thresholdSource: thresh.source,
          severity: SeverityLevel.CRITICAL,
          confidence: ev.confidence || 0.95,
          explanation: `Observed 24h rainfall of ${rainfall24h.toFixed(1)} mm exceeds Extremely Heavy threshold (${thresh.EXTREMELY_HEAVY} mm).`,
          contributingEventIds: [ev.id],
        });
      } else if (rainfall24h >= thresh.VERY_HEAVY) {
        list.push({
          id: `anom_rain24_${ev.id}`,
          type: AnomalyType.POINT_ANOMALY,
          category: 'PRECIPITATION',
          observedValue: rainfall24h,
          unit: 'mm/24h',
          baselineThreshold: thresh.VERY_HEAVY,
          deviation: `+${(rainfall24h - thresh.VERY_HEAVY).toFixed(1)} mm above Very Heavy threshold`,
          thresholdSource: thresh.source,
          severity: SeverityLevel.HIGH,
          confidence: ev.confidence || 0.90,
          explanation: `Observed 24h rainfall of ${rainfall24h.toFixed(1)} mm exceeds Very Heavy threshold (${thresh.VERY_HEAVY} mm).`,
          contributingEventIds: [ev.id],
        });
      } else if (rainfall24h >= thresh.HEAVY) {
        list.push({
          id: `anom_rain24_${ev.id}`,
          type: AnomalyType.POINT_ANOMALY,
          category: 'PRECIPITATION',
          observedValue: rainfall24h,
          unit: 'mm/24h',
          baselineThreshold: thresh.HEAVY,
          deviation: `+${(rainfall24h - thresh.HEAVY).toFixed(1)} mm above Heavy threshold`,
          thresholdSource: thresh.source,
          severity: SeverityLevel.MODERATE,
          confidence: ev.confidence || 0.85,
          explanation: `Observed 24h rainfall of ${rainfall24h.toFixed(1)} mm exceeds Heavy threshold (${thresh.HEAVY} mm).`,
          contributingEventIds: [ev.id],
        });
      }
    }

    // 2. Hourly Cloudburst / Intense Rate of Change Anomaly
    if (typeof rainfall1h === 'number' && rainfall1h >= this.thresholds.IMD_RAINFALL_1H.INTENSE) {
      const hThresh = this.thresholds.IMD_RAINFALL_1H;
      const isCloudburst = rainfall1h >= hThresh.CLOUDBURST;
      const isVeryIntense = rainfall1h >= hThresh.VERY_INTENSE;

      list.push({
        id: `anom_rain1h_${ev.id}`,
        type: AnomalyType.RATE_OF_CHANGE_ANOMALY,
        category: 'INTENSE_PRECIPITATION_BURST',
        observedValue: rainfall1h,
        unit: 'mm/1h',
        baselineThreshold: isCloudburst ? hThresh.CLOUDBURST : isVeryIntense ? hThresh.VERY_INTENSE : hThresh.INTENSE,
        deviation: `+${(rainfall1h - hThresh.INTENSE).toFixed(1)} mm/1h rate surge`,
        thresholdSource: hThresh.source,
        severity: isCloudburst ? SeverityLevel.CRITICAL : isVeryIntense ? SeverityLevel.HIGH : SeverityLevel.MODERATE,
        confidence: ev.confidence || 0.90,
        explanation: `Extreme short-duration precipitation burst of ${rainfall1h.toFixed(1)} mm/hr detected. High flash flood runoff potential.`,
        contributingEventIds: [ev.id],
      });
    }

    // 3. Thermal Fire Radiative Power (FRP) Anomaly
    if (ev.type === EventType.WILDFIRE_HOTSPOT) {
      const frp = payload.frpMW ?? payload.frp;
      const brightness = payload.brightnessKelvin ?? payload.brightness;
      const fThresh = this.thresholds.NASA_FIRMS_THERMAL;

      if (typeof frp === 'number' && frp >= fThresh.MODERATE_FRP_MW) {
        const isExtreme = frp >= fThresh.EXTREME_FRP_MW;
        const isHigh = frp >= fThresh.HIGH_FRP_MW;

        list.push({
          id: `anom_frp_${ev.id}`,
          type: AnomalyType.POINT_ANOMALY,
          category: 'THERMAL_ENERGY_RELEASE',
          observedValue: frp,
          unit: 'MW',
          baselineThreshold: isExtreme ? fThresh.EXTREME_FRP_MW : isHigh ? fThresh.HIGH_FRP_MW : fThresh.MODERATE_FRP_MW,
          deviation: `+${(frp - fThresh.MODERATE_FRP_MW).toFixed(1)} MW above nominal background`,
          thresholdSource: fThresh.source,
          severity: isExtreme ? SeverityLevel.CRITICAL : isHigh ? SeverityLevel.HIGH : SeverityLevel.MODERATE,
          confidence: ev.confidence || 0.92,
          explanation: `Thermal radiative power anomaly of ${frp.toFixed(1)} MW (brightness ${brightness || 'nominal'}K) indicates intense active combustion front.`,
          contributingEventIds: [ev.id],
        });
      }
    }

    // 4. Extreme Surface Wind Anomaly
    const windMps = payload.windSpeedMps ?? (payload.wind_speed_kmh ? payload.wind_speed_kmh / 3.6 : null);
    if (typeof windMps === 'number' && windMps >= this.thresholds.SURFACE_WIND_MPS.GALE) {
      const wThresh = this.thresholds.SURFACE_WIND_MPS;
      const isViolent = windMps >= wThresh.VIOLENT_STORM;
      const isStorm = windMps >= wThresh.STORM;

      list.push({
        id: `anom_wind_${ev.id}`,
        type: AnomalyType.POINT_ANOMALY,
        category: 'SURFACE_WIND',
        observedValue: Number(windMps.toFixed(1)),
        unit: 'm/s',
        baselineThreshold: isViolent ? wThresh.VIOLENT_STORM : isStorm ? wThresh.STORM : wThresh.GALE,
        deviation: `+${(windMps - wThresh.GALE).toFixed(1)} m/s above gale threshold`,
        thresholdSource: wThresh.source,
        severity: isViolent ? SeverityLevel.CRITICAL : isStorm ? SeverityLevel.HIGH : SeverityLevel.MODERATE,
        confidence: ev.confidence || 0.88,
        explanation: `Extreme surface wind speed of ${windMps.toFixed(1)} m/s (${Math.round(windMps * 3.6)} km/h) exceeds WMO Gale baseline.`,
        contributingEventIds: [ev.id],
      });
    }

    return list;
  }

  _detectClusterAnomalies(events) {
    const list = [];
    const hotspots = events.filter((e) => e.type === EventType.WILDFIRE_HOTSPOT);

    if (hotspots.length >= 5) {
      const totalFRP = hotspots.reduce((sum, h) => sum + (h.payload?.frpMW || h.payload?.frp || 20), 0);
      list.push({
        id: `anom_fire_cluster_${hotspots[0].id}`,
        type: AnomalyType.SPATIAL_CLUSTER_ANOMALY,
        category: 'THERMAL_HOTSPOT_CLUSTER',
        observedValue: hotspots.length,
        unit: 'active detection points',
        baselineThreshold: 3,
        deviation: `+${hotspots.length - 3} concentrated detections in sector`,
        thresholdSource: 'Worldview Spatial Fire Clustering Model',
        severity: totalFRP >= 200 ? SeverityLevel.CRITICAL : SeverityLevel.HIGH,
        confidence: 0.95,
        explanation: `High-density spatial cluster of ${hotspots.length} active thermal detections with aggregated ${Math.round(totalFRP)} MW radiative output.`,
        contributingEventIds: hotspots.map((h) => h.id),
      });
    }

    return list;
  }
}
