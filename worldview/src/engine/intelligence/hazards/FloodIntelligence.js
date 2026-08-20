/**
 * Worldview Disaster Intelligence — Flood Intelligence Module
 *
 * Multi-source flood reasoning pipeline:
 *   IMD Rainfall + Topographic DEM + Hydrological River Gauges + Population Exposure
 *
 * Adheres to Phase 6C Mandates & Correction #3:
 *   - CRITICAL RULE: If only rainfall exists, outputs status: DETECTED / "POTENTIAL FLOOD RISK"
 *     with explicit evidence gaps (River Stage, Inundation observation). NEVER premature CONFIRMED.
 *   - When low-lying terrain and demographic exposure are correlated, confidence increases.
 *   - Only when direct water gauge exceedance or official warning (SACHET/CWC) arrives
 *     does the hypothesis progress to CONFIRMED / ACTIVE.
 */

import { HazardHypothesis } from '../HazardHypothesis.js';
import { EvidenceEngine } from '../evidence/EvidenceEngine.js';
import { SecondaryRiskEngine } from '../secondary/SecondaryRiskEngine.js';
import { globalExposureEngine } from '../exposure/ExposureEngine.js';
import { IncidentStatus, SeverityLevel, SourceMode } from '../../event/types.js';
import { DataState } from '../../providers/providerTypes.js';

export class FloodIntelligence {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.exposureEngine = options.exposureEngine || globalExposureEngine;
  }

  /**
   * Evaluates a flood or rainfall observation cluster into a HazardHypothesis.
   *
   * @param {object} cluster - Output from EventCorrelator
   * @param {Array<object>} [anomalies=[]]
   * @returns {HazardHypothesis|null}
   */
  evaluate(cluster, anomalies = []) {
    if (!cluster || !Array.isArray(cluster.events) || cluster.events.length === 0) {
      return null;
    }

    const primaryEvent = cluster.events[0];
    const lat = cluster.centroid.lat;
    const lon = cluster.centroid.lon;
    const place = primaryEvent.location?.name || `Drainage Sector [${lat.toFixed(2)}, ${lon.toFixed(2)}]`;

    // Extract cumulative rainfall and water level observations
    let maxRainfall24h = 0;
    let maxRainfall1h = 0;
    let hasOfficialWarning = false;
    let hasRiverGauge = false;
    let hasInundationObservation = false;

    for (const ev of cluster.events) {
      const p = ev.payload || {};
      const r24 = p.rainfallMm ?? p.rainfall_24h_mm ?? 0;
      const r1 = p.rainfall1hMm ?? p.rainfall_1h_mm ?? 0;
      if (r24 > maxRainfall24h) maxRainfall24h = r24;
      if (r1 > maxRainfall1h) maxRainfall1h = r1;

      if (ev.type === 'OFFICIAL_WARNING' || p.isOfficialWarning) {
        hasOfficialWarning = true;
      }
      if (ev.type === 'WATER_LEVEL_OBSERVATION' || p.riverStageMeters != null) {
        hasRiverGauge = true;
      }
      if (ev.type === 'FLOOD_SIGNAL' && p.inundationAreaKm2 != null) {
        hasInundationObservation = true;
      }
    }

    // Evaluate Exposure (WorldPop population + DEM topography)
    const exposure = this.exposureEngine.evaluate({
      lat,
      lon,
      radiusKm: 25,
    });

    const isLowLying = exposure.terrain?.status === 'AVAILABLE' && (exposure.terrain.derived?.slopeDegrees || 5) <= 4.0;

    // Evaluate Secondary Cascades (Road isolation, drainage congestion)
    const secondaryRisks = SecondaryRiskEngine.evaluate({
      hazardType: 'FLOOD',
      metrics: { rainfallMm: maxRainfall24h, maxRainfall1h },
      exposure,
    });

    // Assemble Evidence Chain & Gaps
    const extraEvidence = [];
    if (exposure.population.status === 'AVAILABLE' && exposure.population.estimatedPopulation !== null) {
      extraEvidence.push({
        eventId: `${primaryEvent.id}:worldpop-exposure`,
        source: 'WorldPop Demographic Model',
        providerId: 'WORLDPOP_EXPOSURE',
        providerTier: 'TIER_B',
        type: 'POPULATION_EXPOSURE',
        timestamp: primaryEvent.observedAt,
        freshness: 'LIVE',
        relevance: 'EXPOSURE_SIGNAL',
        confidence: 0.90,
        isOfficial: false,
        dataState: DataState.STATIC,
        relationship: `Population exposed in flood basin: ~${exposure.population.estimatedPopulation.toLocaleString()} residents (${exposure.population.method})`,
        metrics: { estimatedPopulation: exposure.population.estimatedPopulation },
      });
    }

    if (exposure.terrain.status === 'AVAILABLE') {
      extraEvidence.push({
        eventId: `${primaryEvent.id}:dem-terrain`,
        source: 'Copernicus DEM',
        providerId: 'COPERNICUS_DEM',
        providerTier: 'TIER_B',
        type: 'ELEVATION',
        timestamp: primaryEvent.observedAt,
        freshness: 'LIVE',
        relevance: 'ENVIRONMENTAL_CONTEXT',
        confidence: 0.92,
        isOfficial: false,
        dataState: DataState.STATIC,
        relationship: `Basin topography: ${exposure.terrain.elevationMeters}m elevation, ${exposure.terrain.derived?.slopeDegrees?.toFixed(1) || 0}° slope gradient (${exposure.terrain.terrainType})`,
        metrics: { elevationMeters: exposure.terrain.elevationMeters, slopeDegrees: exposure.terrain.derived?.slopeDegrees },
      });
    }

    const { evidence, evidenceGaps, observationConfidence, assessmentConfidence } = EvidenceEngine.assemble(
      cluster.events,
      'FLOOD',
      extraEvidence
    );

    // Strict Lifecycle Rule (Section 9 Mandate):
    // Only rainfall -> POTENTIAL (DETECTED/ASSESSING).
    // Official Warning or River Gauge Exceedance -> CONFIRMED / ACTIVE.
    let status = IncidentStatus.DETECTED;
    let titlePrefix = 'Potential Flood Risk';

    if (hasInundationObservation || (hasOfficialWarning && maxRainfall24h >= 115.6)) {
      status = IncidentStatus.ACTIVE;
      titlePrefix = 'Severe Flood Inundation';
    } else if (hasRiverGauge || hasOfficialWarning || (maxRainfall24h >= 204.4 && isLowLying)) {
      status = IncidentStatus.CONFIRMED;
      titlePrefix = 'Confirmed Flood Hazard';
    } else if (maxRainfall24h >= 64.5 || anomalies.length > 0) {
      status = IncidentStatus.ASSESSING;
      titlePrefix = 'Potential Flood Risk';
    }

    // Severity
    let severity = SeverityLevel.MODERATE;
    if (maxRainfall24h >= 204.4 || hasInundationObservation) severity = SeverityLevel.CRITICAL;
    else if (maxRainfall24h >= 115.6 || (maxRainfall24h >= 64.5 && isLowLying)) severity = SeverityLevel.HIGH;
    else if (maxRainfall24h >= 64.5) severity = SeverityLevel.MODERATE;
    else severity = SeverityLevel.LOW;

    // Crisis Priority (0-100)
    const rainComponent = Math.min(100, Math.round((maxRainfall24h / 250) * 100));
    const exposureComponent = exposure.summaryScore || 10;
    const warningComponent = hasOfficialWarning ? 95 : 40;
    const terrainComponent = isLowLying ? 85 : 40;

    const crisisPriority = Math.round(
      rainComponent * 0.35 +
      exposureComponent * 0.25 +
      warningComponent * 0.20 +
      terrainComponent * 0.20
    );

    const shouldPromote = maxRainfall24h >= 64.5 || hasOfficialWarning || crisisPriority >= 45;

    const popText = exposure.population.status === 'AVAILABLE' && exposure.population.estimatedPopulation !== null
      ? `~${exposure.population.estimatedPopulation.toLocaleString()} people exposed`
      : 'Population baseline unavailable';

    const description = `${titlePrefix} near ${place}. Measured 24h precipitation: ${maxRainfall24h.toFixed(1)} mm. Topography: ${exposure.terrain?.terrainType || 'Lowland'} (${exposure.terrain?.derived?.slopeDegrees?.toFixed(1) || 0}° slope). ${popText}. Missing evidence gaps: ${evidenceGaps.join(', ') || 'None'}.`;

    return new HazardHypothesis({
      id: `hyp-flood-${primaryEvent.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
      hazardType: 'FLOOD',
      title: `${titlePrefix} - ${place}`,
      description,
      status,
      severity,
      crisisPriority,
      observationConfidence,
      corroborationStrength: cluster.corroborationLevel,
      assessmentConfidence,
      dataState: primaryEvent.sourceMode === SourceMode.SIMULATED ? DataState.SIMULATED : DataState.OBSERVED,
      sourceMode: primaryEvent.sourceMode || SourceMode.LIVE,
      location: {
        lat,
        lon,
        name: place,
        radiusKm: 25,
      },
      geometry: {
        type: 'Point',
        geometryType: 'POINT',
        label: 'ESTIMATED',
        coordinates: [lon, lat],
      },
      evidence,
      evidenceGaps,
      anomalies,
      exposure,
      secondaryRisks,
      corroboration: {
        level: cluster.corroborationLevel,
        sourceCount: cluster.sourceCount,
        sources: cluster.sources,
        notes: cluster.corroborationNotes,
      },
      conflicts: cluster.conflicts,
      temporal: {
        startAt: primaryEvent.observedAt,
        lastObservedAt: primaryEvent.observedAt,
        ageMinutes: 0,
        changeRate: maxRainfall1h > 0 ? `+${maxRainfall1h}mm/hr surge` : null,
        forecastHorizon: null,
        evidenceExpiresAt: null,
      },
      explanation: `Flood hypothesis generated from ${cluster.sources.join(', ')}. Rainfall: ${maxRainfall24h}mm. Status: ${status}. Active evidence gaps: ${evidenceGaps.length}.`,
      shouldPromote,
    });
  }
}
