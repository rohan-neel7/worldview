import { EventType, EvidenceRelevance, SourceMode, IncidentStatus } from '../../event/types.js';

export class TsunamiHazardRule {
  constructor(options = {}) {
    this.name = 'TsunamiHazardRule';
    this.hazardType = 'TSUNAMI';
    this.minMagnitude = options.minMagnitude || 6.5;
    this.maxDepthKm = options.maxDepthKm || 100.0;
    this.requiredEvidenceTypes = [
      'HIGH_MAGNITUDE_SEISMIC',
      'OCEAN_BOTTOM_PRESSURE_ANOMALY',
      'NATIONAL_TSUNAMI_WARNING',
    ];
  }

  /**
   * Evaluates canonical earthquake events for potential tsunami hazard context.
   *
   * @param {Array<object>} events - Normalized canonical events
   * @param {object} [_context={}]
   * @returns {Array<object>}
   */
  evaluate(events) {
    const hypotheses = [];

    const majorQuakes = events.filter((e) => {
      if (e.type === EventType.EARTHQUAKE) {
        const mag = e.payload?.magnitude || 0;
        const depth = e.location?.depthKm !== undefined ? e.location.depthKm : (e.payload?.depthKm || 0);
        return mag >= this.minMagnitude && depth <= this.maxDepthKm;
      }
      return false;
    });

    for (const q of majorQuakes) {
      const mag = q.payload?.magnitude || 0;
      const depth = q.location?.depthKm || 10;
      const place = q.payload?.place || 'Oceanic / Coastal Epicenter';
      const availableTypes = new Set(['HIGH_MAGNITUDE_SEISMIC']);

      const evidence = [
        {
          eventId: q.id,
          source: q.source,
          sourceMode: q.sourceMode,
          type: q.type,
          timestamp: q.observedAt,
          relevance: EvidenceRelevance.PRIMARY_HAZARD,
          confidence: q.confidence,
          relationship: `Major shallow seismic event (M${mag}, depth ${depth}km) meeting tsunami evaluation criteria`,
          metrics: { magnitude: mag, depthKm: depth },
        },
      ];

      // Check if official tsunami flag was raised in provider payload
      if (q.payload?.tsunamiFlag) {
        availableTypes.add('NATIONAL_TSUNAMI_WARNING');
        evidence.push({
          eventId: `${q.id}:tsunami-flag`,
          source: q.source,
          sourceMode: q.sourceMode,
          type: EventType.GENERIC_OBSERVATION,
          timestamp: q.observedAt,
          relevance: EvidenceRelevance.CORROBORATING_OBSERVATION,
          confidence: 0.9,
          relationship: 'USGS/NOAA upstream automated tsunami advisory flag active',
          metrics: { tsunamiFlag: true },
        });
      }

      const evidenceGaps = this.requiredEvidenceTypes.filter((t) => !availableTypes.has(t));

      // Scientific Caution: M>=6.5 creates POTENTIAL TSUNAMI HAZARD, never CONFIRMED without buoy/advisory
      const hasWarning = availableTypes.has('NATIONAL_TSUNAMI_WARNING');
      const confidence = hasWarning ? 0.80 : 0.60;
      const status = hasWarning ? IncidentStatus.ASSESSING : IncidentStatus.DETECTED;

      hypotheses.push({
        id: `hyp-tsunami-${q.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        hazardType: this.hazardType,
        title: `Potential Tsunami Hazard - ${place}`,
        description: `M${mag} shallow seismic disturbance near ${place}. Generated potential tsunami advisory context.${
          hasWarning ? ' Automated warning flag registered.' : ' Oceanic buoy confirmation pending.'
        }`,
        status,
        confidence,
        sourceMode: q.sourceMode || SourceMode.LIVE,
        location: {
          lat: q.location?.lat || 0,
          lon: q.location?.lon || 0,
          name: place,
          radiusKm: 150.0,
        },
        evidence,
        evidenceGaps,
        correlatedEventIds: [q.id],
      });
    }

    return hypotheses;
  }
}
