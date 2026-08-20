import { haversineDistanceKm, calculateCentroid, temporalDiffMinutes } from '../geoUtils.js';
import { EventType, EvidenceRelevance, SourceMode, IncidentStatus } from '../../event/types.js';

export class FloodPotentialRule {
  constructor(options = {}) {
    this.name = 'FloodPotentialRule';
    this.hazardType = 'FLOOD';
    this.maxRadiusKm = options.maxRadiusKm || 35.0;
    this.maxTimeWindowMinutes = options.maxTimeWindowMinutes || 720; // 12 hours
    this.heavyRainThresholdMm = options.heavyRainThresholdMm || 50.0;
    this.extremeRainThresholdMm = options.extremeRainThresholdMm || 100.0;
    this.requiredEvidenceTypes = [
      'EXTREME_PRECIPITATION',
      'RIVER_STAGE_ANOMALY',
      'INUNDATION_OBSERVATION',
    ];
  }

  /**
   * Evaluates canonical events for potential flood hazard signals.
   *
   * @param {Array<object>} events - Normalized canonical events
   * @param {object} [_context={}]
   * @returns {Array<object>} Array of generated hypotheses
   */
  evaluate(events) {
    const hypotheses = [];

    // Filter relevant events: Weather observations, flood signals, water level observations
    const rainEvents = events.filter((e) => {
      if (e.type === EventType.WEATHER || e.type === EventType.METEOROLOGICAL_ANOMALY) {
        const p = e.payload?.precipitationMm || 0;
        const rate = e.payload?.precipitationRateMmH || 0;
        return p >= this.heavyRainThresholdMm || rate >= 25.0;
      }
      return false;
    });

    const waterEvents = events.filter((e) => {
      return (
        e.type === EventType.FLOOD_SIGNAL ||
        e.type === EventType.WATER_LEVEL_OBSERVATION
      );
    });

    if (rainEvents.length === 0 && waterEvents.length === 0) {
      return hypotheses;
    }

    // Evaluate each primary rain event cluster
    for (const rainEvent of rainEvents) {
      const correlated = [rainEvent];
      const evidence = [];
      const availableTypes = new Set(['EXTREME_PRECIPITATION']);

      const precip = rainEvent.payload?.precipitationMm || 0;
      evidence.push({
        eventId: rainEvent.id,
        source: rainEvent.source,
        sourceMode: rainEvent.sourceMode,
        type: rainEvent.type,
        timestamp: rainEvent.observedAt,
        relevance: EvidenceRelevance.PRIMARY_HAZARD,
        confidence: rainEvent.confidence,
        relationship: `Extreme precipitation anomaly (${precip}mm) observed at sensor location`,
        metrics: {
          precipitationMm: precip,
          precipitationRateMmH: rainEvent.payload?.precipitationRateMmH || 0,
        },
      });

      // Check for proximate water gauge or flood signal observations
      for (const wEvent of waterEvents) {
        if (!rainEvent.location || !wEvent.location) continue;
        const dist = haversineDistanceKm(
          rainEvent.location.lat,
          rainEvent.location.lon,
          wEvent.location.lat,
          wEvent.location.lon
        );
        const timeDiff = temporalDiffMinutes(rainEvent.observedAt, wEvent.observedAt);

        if (dist <= this.maxRadiusKm && timeDiff <= this.maxTimeWindowMinutes) {
          correlated.push(wEvent);
          availableTypes.add('RIVER_STAGE_ANOMALY');

          evidence.push({
            eventId: wEvent.id,
            source: wEvent.source,
            sourceMode: wEvent.sourceMode,
            type: wEvent.type,
            timestamp: wEvent.observedAt,
            relevance: EvidenceRelevance.CORROBORATING_OBSERVATION,
            confidence: wEvent.confidence,
            relationship: `Proximate runoff/water gauge elevation (${dist.toFixed(1)}km distance)`,
            metrics: wEvent.payload || {},
          });
        }
      }

      // Determine evidence gaps
      const evidenceGaps = this.requiredEvidenceTypes.filter((t) => !availableTypes.has(t));

      // Scientific Caution: Never claim confirmed flood with only rain data
      let confidence = 0.55;
      let status = IncidentStatus.DETECTED;

      if (availableTypes.has('RIVER_STAGE_ANOMALY')) {
        confidence = 0.85;
        status = IncidentStatus.ASSESSING;
      }
      if (availableTypes.has('INUNDATION_OBSERVATION')) {
        confidence = 0.95;
        status = IncidentStatus.CONFIRMED;
      }

      // Check if any correlated event is simulated
      const isSimulated = correlated.some((e) => e.sourceMode === SourceMode.SIMULATED);
      const sourceMode = isSimulated ? SourceMode.SIMULATED : SourceMode.LIVE;

      const centroid = calculateCentroid(correlated);
      const locationName = rainEvent.payload?.place || `Sector [${centroid.lat.toFixed(2)}, ${centroid.lon.toFixed(2)}]`;

      hypotheses.push({
        id: `hyp-flood-${rainEvent.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        hazardType: this.hazardType,
        title: `Potential Flood Risk - ${locationName}`,
        description: `Elevated flood hazard triggered by intense precipitation (${precip}mm)${
          availableTypes.has('RIVER_STAGE_ANOMALY') ? ' and correlated catchment gauge elevation.' : ' without confirmed river stage telemetry.'
        }`,
        status,
        confidence,
        sourceMode,
        location: {
          lat: centroid.lat,
          lon: centroid.lon,
          name: locationName,
          radiusKm: this.maxRadiusKm,
        },
        evidence,
        evidenceGaps,
        correlatedEventIds: correlated.map((e) => e.id),
      });
    }

    return hypotheses;
  }
}
