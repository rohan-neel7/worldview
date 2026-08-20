/**
 * Worldview Disaster Intelligence — Earthquake Intelligence Module
 *
 * Adheres to Phase 6C Corrections #4, #5 & #8:
 *   - Uses "ESTIMATED SHAKING EXTENT" (never unsupported "isoseismals") for heuristic geometry.
 *   - Employs qualitative aftershock decay sequence characterization.
 *   - Integrates multi-source corroboration (USGS + GDACS + SACHET) without overwriting evidence.
 */

import { HazardHypothesis } from '../HazardHypothesis.js';
import { EvidenceEngine } from '../evidence/EvidenceEngine.js';
import { SecondaryRiskEngine } from '../secondary/SecondaryRiskEngine.js';
import { globalExposureEngine } from '../exposure/ExposureEngine.js';
import { IncidentStatus, SeverityLevel, SourceMode } from '../../event/types.js';
import { DataState } from '../../providers/providerTypes.js';

export class EarthquakeIntelligence {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.exposureEngine = options.exposureEngine || globalExposureEngine;
  }

  /**
   * Evaluates an earthquake observation cluster into a HazardHypothesis.
   *
   * @param {object} cluster - Output from EventCorrelator
   * @param {Array<object>} [anomalies=[]]
   * @returns {HazardHypothesis|null}
   */
  evaluate(cluster, anomalies = []) {
    if (!cluster || cluster.hazardType !== 'EARTHQUAKE' || !Array.isArray(cluster.events) || cluster.events.length === 0) {
      return null;
    }

    const primaryEvent = cluster.events.find((e) => e.type === 'EARTHQUAKE') || cluster.events[0];
    const payload = primaryEvent.payload || {};

    const mag = typeof payload.magnitude === 'number' ? payload.magnitude : 5.0;
    const depth = primaryEvent.location?.depthKm ?? (payload.depthKm || 10);
    const lat = primaryEvent.location?.lat || cluster.centroid.lat;
    const lon = primaryEvent.location?.lon || cluster.centroid.lon;
    const place = primaryEvent.location?.name || payload.place || `Epicenter [${lat.toFixed(2)}, ${lon.toFixed(2)}]`;
    const tsunamiFlag = Boolean(payload.tsunamiFlag);

    // Heuristic Estimated Shaking Extent (Correction #4)
    const severeRadiusKm = Math.min(300, Math.round(Math.pow(10, 0.4 * (mag - 4.8)) * Math.max(0.5, 15 / Math.max(5, depth))));
    const moderateRadiusKm = Math.min(600, Math.round(Math.pow(10, 0.45 * (mag - 4.0)) * Math.max(0.6, 20 / Math.max(5, depth))));

    // Evaluate Exposure (WorldPop population + DEM topography)
    const exposure = this.exposureEngine.evaluate({
      lat,
      lon,
      radiusKm: moderateRadiusKm || 50,
    });

    // Evaluate Secondary Cascades (Aftershocks, Tsunami, Coseismic Landslides)
    const secondaryRisks = SecondaryRiskEngine.evaluate({
      hazardType: 'EARTHQUAKE',
      metrics: { magnitude: mag, depthKm: depth, tsunamiFlag },
      exposure,
    });

    // Construct Baseline Exposure Evidence for chain
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
        relationship: `Demographic exposure baseline: ~${exposure.population.estimatedPopulation.toLocaleString()} residents in ${moderateRadiusKm}km shaking perimeter (${exposure.population.method})`,
        metrics: {
          estimatedPopulation: exposure.population.estimatedPopulation,
          densityPerKm2: exposure.population.densityPerKm2,
          radiusKm: moderateRadiusKm,
        },
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
        relationship: `Topographic baseline: ${exposure.terrain.elevationMeters}m elevation, ${exposure.terrain.derived?.slopeDegrees?.toFixed(1) || 0}° slope gradient (${exposure.terrain.terrainType})`,
        metrics: {
          elevationMeters: exposure.terrain.elevationMeters,
          slopeDegrees: exposure.terrain.derived?.slopeDegrees,
        },
      });
    }

    // Assemble Traceable Evidence Chain & Gaps
    const { evidence, evidenceGaps, observationConfidence, assessmentConfidence } = EvidenceEngine.assemble(
      cluster.events,
      'EARTHQUAKE',
      extraEvidence
    );

    // Calculate Hazard Severity & Crisis Priority (0-100)
    // Severity: Based on magnitude and depth
    let severity = SeverityLevel.MODERATE;
    if (mag >= 7.0) severity = SeverityLevel.CRITICAL;
    else if (mag >= 6.0) severity = SeverityLevel.HIGH;
    else if (mag >= 4.5) severity = SeverityLevel.MODERATE;
    else severity = SeverityLevel.LOW;

    // Crisis Priority: Weighted multi-factor synthesis
    // (Hazard 35% + Exposure 30% + Secondary Cascades 20% + Corroboration 15%)
    const hazardComponent = Math.min(100, Math.round((mag / 8.5) * 100));
    const exposureComponent = exposure.summaryScore || 10;
    const secondaryComponent =
      secondaryRisks.tsunami?.level === 'HIGH' ? 90 : secondaryRisks.aftershocks?.level === 'HIGH' ? 75 : 40;
    const corroborationComponent = cluster.sources.length >= 2 ? 90 : 60;

    const crisisPriority = Math.round(
      hazardComponent * 0.35 +
      exposureComponent * 0.30 +
      secondaryComponent * 0.20 +
      corroborationComponent * 0.15
    );

    // Lifecycle Status
    let status = IncidentStatus.DETECTED;
    if (mag >= 6.5) status = IncidentStatus.ACTIVE;
    else if (mag >= 5.0 || cluster.sources.length >= 2) status = IncidentStatus.CONFIRMED;
    else status = IncidentStatus.ASSESSING;

    const shouldPromote = mag >= 4.5 || crisisPriority >= 40;

    const popText = exposure.population.status === 'AVAILABLE' && exposure.population.estimatedPopulation !== null
      ? `~${exposure.population.estimatedPopulation.toLocaleString()} people exposed`
      : 'Population exposure unavailable (ocean/remote)';

    const description = `M${mag.toFixed(1)} seismic rupture (depth ${depth}km) near ${place}. Estimated shaking extent: ${moderateRadiusKm}km perimeter (${popText}). ${cluster.corroborationNotes}`;

    return new HazardHypothesis({
      id: `hyp-quake-${primaryEvent.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
      hazardType: 'EARTHQUAKE',
      title: `M${mag.toFixed(1)} Earthquake - ${place}`,
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
        depthKm: depth,
        radiusKm: moderateRadiusKm,
      },
      geometry: {
        type: 'Point',
        geometryType: 'POINT',
        label: 'ESTIMATED',
        coordinates: [lon, lat],
        estimatedShakingExtent: {
          severeRadiusKm,
          moderateRadiusKm,
          label: 'ESTIMATED SHAKING EXTENT',
        },
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
        changeRate: null,
        forecastHorizon: null,
        evidenceExpiresAt: null,
      },
      explanation: `Earthquake hypothesis formed via ${cluster.sources.join(' + ')}. Hazard: M${mag.toFixed(1)} (depth ${depth}km). Priority: ${crisisPriority}/100. ${cluster.conflicts.length > 0 ? 'Discrepancy in source telemetry recorded.' : ''}`,
      shouldPromote,
    });
  }
}
