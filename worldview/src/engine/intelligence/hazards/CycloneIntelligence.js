/**
 * Worldview Disaster Intelligence — Cyclone Intelligence Module
 *
 * Adheres to Phase 6C Mandates & Correction #6:
 *   - Strictly distinguishes:
 *       • OBSERVED TRACK (Actual recorded storm positions)
 *       • FORECAST TRACK (Projected storm coordinates & forecast cone)
 *       • WORLDVIEW IMPACT ESTIMATE (Derived exposure & qualitative storm surge)
 *   - Treats forecast cones as projected risk areas, NEVER confirmed impact.
 *   - Uses qualitative POTENTIAL STORM-SURGE EXPOSURE assessment.
 */

import { HazardHypothesis } from '../HazardHypothesis.js';
import { EvidenceEngine } from '../evidence/EvidenceEngine.js';
import { SecondaryRiskEngine } from '../secondary/SecondaryRiskEngine.js';
import { globalExposureEngine } from '../exposure/ExposureEngine.js';
import { IncidentStatus, SeverityLevel, SourceMode } from '../../event/types.js';
import { DataState } from '../../providers/providerTypes.js';

export class CycloneIntelligence {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.exposureEngine = options.exposureEngine || globalExposureEngine;
  }

  /**
   * Evaluates a cyclone observation cluster into a HazardHypothesis.
   *
   * @param {object} cluster - Output from EventCorrelator
   * @param {Array<object>} [anomalies=[]]
   * @returns {HazardHypothesis|null}
   */
  evaluate(cluster, anomalies = []) {
    if (!cluster || cluster.hazardType !== 'CYCLONE' || !Array.isArray(cluster.events) || cluster.events.length === 0) {
      return null;
    }

    const primaryEvent = cluster.events.find((e) => e.type === 'CYCLONE' || e.type === 'HAZARD_TRACK') || cluster.events[0];
    const payload = primaryEvent.payload || {};

    const cycloneName = payload.cycloneName || payload.name || 'Tropical Cyclone';
    const stage = payload.stage || 'Cyclonic Storm';
    const lat = primaryEvent.location?.lat || cluster.centroid.lat;
    const lon = primaryEvent.location?.lon || cluster.centroid.lon;
    const centralPressureHpa = payload.centralPressureHpa || 980;
    const maxWindMps = payload.maxSustainedWindMps || (payload.max_wind_kmph ? payload.max_wind_kmph / 3.6 : 30);
    const forecastTrack = Array.isArray(payload.forecastTrack) ? payload.forecastTrack : [];
    const place = primaryEvent.location?.name || `Sector [${lat.toFixed(2)}, ${lon.toFixed(2)}]`;

    // Impact radius (outer cyclonic storm gale radius ~ 200-350km)
    const impactRadiusKm = 200;

    // Evaluate Exposure (WorldPop demographic + DEM topography)
    const exposure = this.exposureEngine.evaluate({
      lat,
      lon,
      radiusKm: impactRadiusKm,
    });

    // Evaluate Secondary Cascades (Qualitative Storm Surge & Gale Winds)
    const secondaryRisks = SecondaryRiskEngine.evaluate({
      hazardType: 'CYCLONE',
      metrics: { maxSustainedWindMps: maxWindMps, centralPressureHpa },
      exposure,
    });

    // Assemble Traceable Evidence Chain & Gaps
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
        relationship: `Coastal population in storm swath: ~${exposure.population.estimatedPopulation.toLocaleString()} residents (${exposure.population.method})`,
        metrics: { estimatedPopulation: exposure.population.estimatedPopulation },
      });
    }

    const { evidence, evidenceGaps, observationConfidence, assessmentConfidence } = EvidenceEngine.assemble(
      cluster.events,
      'CYCLONE',
      extraEvidence
    );

    // Severity based on sustained wind and central pressure
    let severity = SeverityLevel.MODERATE;
    if (maxWindMps >= 45 || centralPressureHpa <= 940) {
      severity = SeverityLevel.CRITICAL; // Super Cyclonic / Cat 4-5
    } else if (maxWindMps >= 32 || centralPressureHpa <= 970) {
      severity = SeverityLevel.HIGH; // Very Severe Cyclonic Storm
    } else if (maxWindMps >= 20) {
      severity = SeverityLevel.MODERATE;
    } else {
      severity = SeverityLevel.LOW;
    }

    // Crisis Priority (0-100)
    const windComponent = Math.min(100, Math.round((maxWindMps / 60) * 100));
    const pressureComponent = Math.min(100, Math.max(0, Math.round((1010 - centralPressureHpa) * 1.5)));
    const exposureComponent = exposure.summaryScore || 10;
    const surgeComponent = secondaryRisks.stormSurge?.level === 'HIGH' ? 90 : 60;

    const crisisPriority = Math.round(
      windComponent * 0.35 +
      pressureComponent * 0.25 +
      exposureComponent * 0.25 +
      surgeComponent * 0.15
    );

    // Status: Tracking Bulletin -> CONFIRMED / ACTIVE
    let status = IncidentStatus.ACTIVE;
    if (maxWindMps < 25 && forecastTrack.length > 0) {
      status = IncidentStatus.ASSESSING;
    }

    const description = `Tropical Cyclone "${cycloneName}" (${stage}). Max sustained winds: ${maxWindMps.toFixed(1)} m/s (${Math.round(maxWindMps * 3.6)} km/h), central pressure: ${centralPressureHpa} hPa. Forecast track points: ${forecastTrack.length}. ${secondaryRisks.stormSurge?.note || ''}`;

    const rweId = cluster.realWorldEventId || primaryEvent.id;
    return new HazardHypothesis({
      id: `hyp-cyclone-${rweId.replace(/[^a-zA-Z0-9]/g, '_')}`,
      hazardType: 'CYCLONE',
      title: `Tropical Cyclone "${cycloneName}" - ${stage}`,
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
        radiusKm: impactRadiusKm,
      },
      geometry: {
        type: 'Point',
        geometryType: 'POINT',
        label: 'OFFICIAL',
        coordinates: [lon, lat],
        forecastTrack: forecastTrack.map((f) => ({ ...f, label: 'FORECAST TRACK' })),
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
        changeRate: `${Math.round(maxWindMps * 3.6)} km/h max wind`,
        forecastHorizon: `${forecastTrack.length * 12}h forecast projection`,
        evidenceExpiresAt: null,
      },
      explanation: `Cyclone intelligence evaluated from ${cluster.sources.join(', ')}. Intensity: ${stage}. Priority: ${crisisPriority}/100.`,
      shouldPromote: true,
    });
  }
}
