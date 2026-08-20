/**
 * Worldview Disaster Intelligence — Evidence Engine
 *
 * Assembles immutable, traceable evidence chains and evaluates missing evidence gaps.
 *
 * Adheres to Phase 6C Corrections #8, #10 & #11:
 *   - Answers "WHY does Worldview believe this hypothesis?"
 *   - Every evidence item carries source, providerTier, observedAt, freshness,
 *     relevance, confidence, relationship, and dataState.
 *   - Evaluates explicit evidence gaps for every hazard type.
 *   - Decays assessment confidence deterministically if evidence is STALE or EXPIRED.
 */

import { EvidenceRelevance, FreshnessStatus, SourceMode } from '../../event/types.js';
import { DataState, ProviderTier } from '../../providers/providerTypes.js';

export const REQUIRED_EVIDENCE_SPEC = Object.freeze({
  EARTHQUAKE: [
    { key: 'SEISMIC_TELEMETRY', label: 'Primary Seismic Sensor Network (USGS/NCS/BMKG)' },
    { key: 'DEMOGRAPHIC_EXPOSURE', label: 'Demographic Exposure Model (WorldPop)' },
    { key: 'CRITICAL_INFRASTRUCTURE', label: 'Critical Infrastructure Catalog' },
  ],
  TSUNAMI: [
    { key: 'SEISMIC_TELEMETRY', label: 'Primary Marine Rupture Telemetry' },
    { key: 'OFFICIAL_TSUNAMI_ADVISORY', label: 'Official Tsunami Advisory (InaTEWS/PTWC/ITEWC)' },
    { key: 'DART_BUOY_TELEMETRY', label: 'DART Deep-Ocean Buoy Wave Signal' },
  ],
  FLOOD: [
    { key: 'PRECIPITATION_OBSERVATION', label: 'Precipitation Telemetry / Radar (IMD/GPM)' },
    { key: 'TOPOGRAPHIC_DEM', label: 'Digital Elevation Model Drainage (Copernicus DEM)' },
    { key: 'RIVER_GAUGE_TELEMETRY', label: 'River Gauge / Hydrological Telemetry' },
    { key: 'INUNDATION_EXTENT_OBSERVATION', label: 'Satellite / Ground Inundation Extent' },
  ],
  WILDFIRE: [
    { key: 'THERMAL_HOTSPOT_OBSERVATION', label: 'Satellite Thermal Hotspot Detection (NASA FIRMS)' },
    { key: 'SURFACE_WIND_TELEMETRY', label: 'Surface Wind & Relative Humidity Telemetry' },
    { key: 'VEGETATION_FUEL_STATE', label: 'Vegetation Moisture / Fuel Index' },
  ],
  CYCLONE: [
    { key: 'CYCLONE_TRACK_BULLETIN', label: 'Official Cyclone Track & Intensity Bulletin (IMD/JTWC)' },
    { key: 'BAROMETRIC_WIND_OBSERVATION', label: 'Surface Barometric & Wind Telemetry' },
    { key: 'COASTAL_RADAR_OBSERVATION', label: 'Doppler Weather Radar Coastal Echoes' },
  ],
});

export class EvidenceEngine {
  /**
   * Assembles a structured evidence chain from contributing events.
   *
   * @param {Array<object>} events - Normalized CanonicalEvents
   * @param {string} hazardType - 'EARTHQUAKE' | 'FLOOD' | 'WILDFIRE' | 'CYCLONE' | 'TSUNAMI'
   * @param {object} [extraEvidence=[]]
   * @returns {{ evidence: Array<object>, evidenceGaps: Array<string>, observationConfidence: number, assessmentConfidence: number }}
   */
  static assemble(events, hazardType, extraEvidence = []) {
    const evidence = [];
    const availableKeys = new Set();
    let totalObsConfidence = 0;
    let obsCount = 0;

    for (const ev of events) {
      if (!ev) continue;

      const provenance = ev.provenance || {};
      const source = ev.source || provenance.source || 'UNKNOWN';
      const providerTier = provenance.providerTier || (ev.source === 'USGS' || ev.source === 'IMD' || ev.source === 'SACHET' ? ProviderTier.TIER_A : ProviderTier.TIER_B);
      const isOfficial = Boolean(provenance.isOfficial || ev.payload?.isOfficial);
      const freshness = ev.freshness?.status || FreshnessStatus.LIVE;
      const dataState = provenance.dataState || ev.sourceMode || DataState.OBSERVED;
      const conf = typeof ev.confidence === 'number' ? ev.confidence : 0.85;

      totalObsConfidence += conf;
      obsCount++;

      // Determine relevance
      let relevance = EvidenceRelevance.CORROBORATING_OBSERVATION;
      if (isOfficial) {
        relevance = EvidenceRelevance.OFFICIAL_WARNING;
        availableKeys.add('OFFICIAL_WARNING');
      } else if (ev.type === 'EARTHQUAKE' || ev.type === 'WILDFIRE_HOTSPOT' || ev.type === 'CYCLONE') {
        relevance = EvidenceRelevance.PRIMARY_HAZARD;
        availableKeys.add('PRIMARY_HAZARD');
      } else if (ev.type === 'WEATHER' || ev.type === 'RAINFALL') {
        relevance = EvidenceRelevance.ENVIRONMENTAL_CONTEXT;
        availableKeys.add('PRECIPITATION_OBSERVATION');
      }

      if (ev.type === 'EARTHQUAKE') availableKeys.add('SEISMIC_TELEMETRY');
      if (ev.type === 'WILDFIRE_HOTSPOT') availableKeys.add('THERMAL_HOTSPOT_OBSERVATION');
      if (ev.type === 'CYCLONE' || ev.type === 'HAZARD_TRACK') availableKeys.add('CYCLONE_TRACK_BULLETIN');
      if (ev.type === 'WATER_LEVEL_OBSERVATION') availableKeys.add('RIVER_GAUGE_TELEMETRY');

      evidence.push({
        eventId: ev.id,
        source,
        sourceMode: ev.sourceMode || provenance.sourceMode || SourceMode.LIVE,
        providerId: provenance.providerId || source,
        providerTier,
        type: ev.type,
        timestamp: ev.observedAt || new Date().toISOString(),
        freshness,
        relevance,
        confidence: conf,
        isOfficial,
        dataState,
        relationship: this._buildRelationship(ev),
        metrics: ev.payload || {},
      });
    }

    // Attach extra derived baseline evidence (e.g. WorldPop, DEM)
    if (Array.isArray(extraEvidence)) {
      for (const item of extraEvidence) {
        evidence.push(item);
        if (item.type === 'POPULATION_EXPOSURE') availableKeys.add('DEMOGRAPHIC_EXPOSURE');
        if (item.type === 'ELEVATION') availableKeys.add('TOPOGRAPHIC_DEM');
      }
    }

    // Calculate observation confidence
    const observationConfidence = obsCount > 0 ? Number((totalObsConfidence / obsCount).toFixed(2)) : 0.70;

    // Evaluate evidence gaps
    const requiredSpecs = REQUIRED_EVIDENCE_SPEC[hazardType.toUpperCase()] || [];
    const evidenceGaps = [];

    for (const req of requiredSpecs) {
      if (!availableKeys.has(req.key)) {
        evidenceGaps.push(req.label);
      }
    }

    // Compute Assessment Confidence with evidence gap & staleness penalties (Correction #8 & #10)
    let assessmentConfidence = observationConfidence;

    // Evidence gap penalty (e.g. missing river gauge for flood)
    if (evidenceGaps.length > 0) {
      const gapPenalty = Math.min(0.35, evidenceGaps.length * 0.10);
      assessmentConfidence -= gapPenalty;
    }

    // Staleness penalty (only for live feeds, static datasets are exempt)
    const hasStale = evidence.some((e) => e.dataState !== DataState.STATIC && e.freshness === FreshnessStatus.STALE);
    const hasExpired = evidence.some((e) => e.dataState !== DataState.STATIC && e.freshness === FreshnessStatus.EXPIRED);

    if (hasExpired) {
      assessmentConfidence -= 0.30;
    } else if (hasStale) {
      assessmentConfidence -= 0.15;
    }

    assessmentConfidence = Number(Math.max(0.15, Math.min(1.0, assessmentConfidence)).toFixed(2));

    return {
      evidence,
      evidenceGaps,
      observationConfidence,
      assessmentConfidence,
    };
  }

  static _buildRelationship(ev) {
    const payload = ev.payload || {};
    if (ev.type === 'EARTHQUAKE') {
      return `Seismic telemetry: M${payload.magnitude || 5.0}, depth ${payload.depthKm || 10}km near ${payload.place || 'Epicenter'}`;
    }
    if (ev.type === 'WILDFIRE_HOTSPOT') {
      return `Active thermal hotspot detection (FRP ${payload.frpMW || payload.frp || 25} MW, brightness ${payload.brightnessKelvin || payload.brightness || 340}K)`;
    }
    if (ev.type === 'OFFICIAL_WARNING') {
      return `Official warning bulletin: "${payload.headline || payload.event || 'Emergency Alert'}" issued by ${ev.provenance?.authority || ev.source}`;
    }
    if (ev.type === 'WEATHER' || ev.type === 'RAINFALL') {
      return `Meteorological observation: ${payload.rainfallMm || 0}mm 24h rainfall, wind ${payload.windSpeedMps || 0}m/s`;
    }
    if (ev.type === 'CYCLONE' || ev.type === 'HAZARD_TRACK') {
      return `Tropical cyclone bulletin: "${payload.cycloneName || 'Cyclone'}" max wind ${payload.maxSustainedWindMps || 30}m/s, central pressure ${payload.centralPressureHpa || 980}hPa`;
    }
    return `Observational telemetry from ${ev.source}`;
  }
}
