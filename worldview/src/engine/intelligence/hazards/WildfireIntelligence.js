/**
 * Worldview Disaster Intelligence — Wildfire Intelligence Module
 *
 * Adheres to Phase 6C Mandates & Scenario D:
 *   - Aggregates multiple NASA FIRMS active hotspots into a single unified Fire Cluster hypothesis.
 *   - NEVER generates individual crises for individual satellite hotspots.
 *   - Correlates ambient wind velocity, relative humidity, and demographic exposure.
 */

import { HazardHypothesis } from '../HazardHypothesis.js';
import { EvidenceEngine } from '../evidence/EvidenceEngine.js';
import { SecondaryRiskEngine } from '../secondary/SecondaryRiskEngine.js';
import { globalExposureEngine } from '../exposure/ExposureEngine.js';
import { IncidentStatus, SeverityLevel, SourceMode } from '../../event/types.js';
import { DataState } from '../../providers/providerTypes.js';

export class WildfireIntelligence {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.exposureEngine = options.exposureEngine || globalExposureEngine;
  }

  /**
   * Evaluates a wildfire observation cluster into a single HazardHypothesis.
   *
   * @param {object} cluster - Output from EventCorrelator
   * @param {Array<object>} [anomalies=[]]
   * @returns {HazardHypothesis|null}
   */
  evaluate(cluster, anomalies = []) {
    if (!cluster || cluster.hazardType !== 'WILDFIRE' || !Array.isArray(cluster.events) || cluster.events.length === 0) {
      return null;
    }

    const hotspots = cluster.events.filter((e) => e.type === 'WILDFIRE_HOTSPOT');
    if (hotspots.length === 0) return null;

    const lat = cluster.centroid.lat;
    const lon = cluster.centroid.lon;
    const place = `Thermal Fire Complex [${lat.toFixed(2)}, ${lon.toFixed(2)}]`;

    // Compute aggregated Fire Radiative Power (FRP) and maximum brightness
    let totalFRP = 0;
    let maxBrightness = 0;

    for (const h of hotspots) {
      const p = h.payload || {};
      const frp = p.frpMW ?? p.frp ?? 25.0;
      const b = p.brightnessKelvin ?? p.brightness ?? 330.0;
      totalFRP += frp;
      if (b > maxBrightness) maxBrightness = b;
    }

    // Extract correlated surface wind speed
    let maxWindSpeedMps = 0;
    for (const ev of cluster.events) {
      if (ev.type === 'WEATHER') {
        const w = ev.payload?.windSpeedMps || 0;
        if (w > maxWindSpeedMps) maxWindSpeedMps = w;
      }
    }

    // Evaluate Exposure (WorldPop population + DEM topography)
    const exposure = this.exposureEngine.evaluate({
      lat,
      lon,
      radiusKm: 25,
    });

    // Evaluate Secondary Cascades (Spread velocity, smoke plume)
    const secondaryRisks = SecondaryRiskEngine.evaluate({
      hazardType: 'WILDFIRE',
      metrics: { frpMW: totalFRP, windSpeedMps: maxWindSpeedMps },
      exposure,
    });

    // Assemble Traceable Evidence Chain & Gaps
    const extraEvidence = [];
    if (exposure.population.status === 'AVAILABLE' && exposure.population.estimatedPopulation !== null) {
      extraEvidence.push({
        eventId: `${cluster.clusterId}:worldpop-exposure`,
        source: 'WorldPop Demographic Model',
        providerId: 'WORLDPOP_EXPOSURE',
        providerTier: 'TIER_B',
        type: 'POPULATION_EXPOSURE',
        timestamp: hotspots[0].observedAt,
        freshness: 'LIVE',
        relevance: 'EXPOSURE_SIGNAL',
        confidence: 0.90,
        isOfficial: false,
        dataState: DataState.STATIC,
        relationship: `Population exposed to wildfire / smoke zone: ~${exposure.population.estimatedPopulation.toLocaleString()} residents (${exposure.population.method})`,
        metrics: { estimatedPopulation: exposure.population.estimatedPopulation },
      });
    }

    const { evidence, evidenceGaps, observationConfidence, assessmentConfidence } = EvidenceEngine.assemble(
      cluster.events,
      'WILDFIRE',
      extraEvidence
    );

    // Severity
    let severity = SeverityLevel.MODERATE;
    if (totalFRP >= 300 || (totalFRP >= 150 && maxWindSpeedMps >= 14.0)) {
      severity = SeverityLevel.CRITICAL;
    } else if (totalFRP >= 100 || (totalFRP >= 50 && maxWindSpeedMps >= 10.0)) {
      severity = SeverityLevel.HIGH;
    } else if (totalFRP >= 30) {
      severity = SeverityLevel.MODERATE;
    } else {
      severity = SeverityLevel.LOW;
    }

    // Crisis Priority (0-100)
    const thermalComponent = Math.min(100, Math.round((totalFRP / 350) * 100));
    const windComponent = Math.min(100, Math.round((maxWindSpeedMps / 25) * 100));
    const exposureComponent = exposure.summaryScore || 10;
    const clusterDensityComponent = Math.min(100, hotspots.length * 10);

    const crisisPriority = Math.round(
      thermalComponent * 0.40 +
      windComponent * 0.20 +
      exposureComponent * 0.25 +
      clusterDensityComponent * 0.15
    );

    // Status: Hotspot cluster -> DETECTED / ASSESSING -> CONFIRMED if high confidence or FRP >= 100
    let status = IncidentStatus.DETECTED;
    if (totalFRP >= 150 || (hotspots.length >= 5 && maxWindSpeedMps >= 10.0)) {
      status = IncidentStatus.ACTIVE;
    } else if (totalFRP >= 60 || hotspots.length >= 3) {
      status = IncidentStatus.CONFIRMED;
    } else {
      status = IncidentStatus.ASSESSING;
    }

    const shouldPromote = hotspots.length >= 3 || totalFRP >= 50 || crisisPriority >= 45;

    const description = `Active wildfire complex comprising ${hotspots.length} correlated thermal detections (cumulative FRP: ${Math.round(totalFRP)} MW, peak brightness: ${maxBrightness.toFixed(1)}K) near ${place}.${
      maxWindSpeedMps > 0 ? ` Surface wind speed: ${maxWindSpeedMps.toFixed(1)} m/s.` : ''
    }`;

    const rweId = cluster.realWorldEventId || cluster.clusterId;
    return new HazardHypothesis({
      id: `hyp-fire-${rweId.replace(/[^a-zA-Z0-9]/g, '_')}`,
      hazardType: 'WILDFIRE',
      title: `Wildfire Complex (${hotspots.length} Hotspots) - ${place}`,
      description,
      status,
      severity,
      crisisPriority,
      observationConfidence,
      corroborationStrength: cluster.corroborationLevel,
      assessmentConfidence,
      dataState: hotspots[0].sourceMode === SourceMode.SIMULATED ? DataState.SIMULATED : DataState.INFERRED,
      sourceMode: hotspots[0].sourceMode || SourceMode.LIVE,
      location: {
        lat,
        lon,
        name: place,
        radiusKm: 25,
      },
      geometry: {
        type: 'Point',
        geometryType: 'POINT',
        label: 'MODELED',
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
        startAt: hotspots[0].observedAt,
        lastObservedAt: hotspots[hotspots.length - 1].observedAt,
        ageMinutes: 0,
        changeRate: `${hotspots.length} active thermal detections`,
        forecastHorizon: null,
        evidenceExpiresAt: null,
      },
      explanation: `Wildfire hypothesis formed by clustering ${hotspots.length} FIRMS active detections. Cumulative radiative output: ${Math.round(totalFRP)} MW.`,
      shouldPromote,
    });
  }
}
