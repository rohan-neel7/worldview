import { haversineDistanceKm, calculateCentroid, temporalDiffMinutes } from '../geoUtils.js';
import { EventType, EvidenceRelevance, SourceMode, IncidentStatus } from '../../event/types.js';

export class WildfireRule {
  constructor(options = {}) {
    this.name = 'WildfireRule';
    this.hazardType = 'WILDFIRE';
    this.maxRadiusKm = options.maxRadiusKm || 25.0;
    this.maxTimeWindowMinutes = options.maxTimeWindowMinutes || 360; // 6 hours
    this.requiredEvidenceTypes = [
      'THERMAL_HOTSPOT_OBSERVATION',
      'HIGH_WIND_ENVIRONMENTAL',
      'LOW_HUMIDITY_OBSERVATION',
    ];
  }

  /**
   * Evaluates canonical events for wildfire hazards.
   * STRICT SCIENTIFIC RULE: High wind alone is NEVER treated as proof of wildfire.
   * An empirical thermal hotspot detection is mandatory.
   *
   * @param {Array<object>} events - Normalized canonical events
   * @param {object} [_context={}]
   * @returns {Array<object>}
   */
  evaluate(events) {
    const hypotheses = [];

    // 1. Check for thermal hotspot detections (e.g. from satellite or synthetic fixture)
    const hotspots = events.filter((e) => e.type === EventType.WILDFIRE_HOTSPOT);

    // If no thermal hotspots exist, reject immediately (weather alone is NOT a wildfire)
    if (hotspots.length === 0) {
      return hypotheses;
    }

    const weatherEvents = events.filter((e) => e.type === EventType.WEATHER);

    for (const spot of hotspots) {
      const correlated = [spot];
      const availableTypes = new Set(['THERMAL_HOTSPOT_OBSERVATION']);

      const brightnessTemp = spot.payload?.brightnessTempK || spot.payload?.intensity || 350;
      const evidence = [
        {
          eventId: spot.id,
          source: spot.source,
          sourceMode: spot.sourceMode,
          type: spot.type,
          timestamp: spot.observedAt,
          relevance: EvidenceRelevance.PRIMARY_HAZARD,
          confidence: spot.confidence,
          relationship: `Thermal anomaly detected (brightness ${brightnessTemp}K, FRP ${spot.payload?.frp || 45}MW)`,
          metrics: spot.payload || {},
        },
      ];

      // Correlate proximate weather observations
      for (const w of weatherEvents) {
        if (!spot.location || !w.location) continue;
        const dist = haversineDistanceKm(spot.location.lat, spot.location.lon, w.location.lat, w.location.lon);
        const timeDiff = temporalDiffMinutes(spot.observedAt, w.observedAt);

        if (dist <= this.maxRadiusKm && timeDiff <= this.maxTimeWindowMinutes) {
          const windSpeed = w.payload?.windSpeedMps || 0;
          if (windSpeed > 8.0) {
            correlated.push(w);
            availableTypes.add('HIGH_WIND_ENVIRONMENTAL');
            evidence.push({
              eventId: w.id,
              source: w.source,
              sourceMode: w.sourceMode,
              type: w.type,
              timestamp: w.observedAt,
              relevance: EvidenceRelevance.ENVIRONMENTAL_CONTEXT,
              confidence: w.confidence,
              relationship: `Elevated wind speed (${windSpeed}m/s) accelerating potential fire spread rate`,
              metrics: { windSpeedMps: windSpeed },
            });
          }
        }
      }

      const evidenceGaps = this.requiredEvidenceTypes.filter((t) => !availableTypes.has(t));
      const hasWind = availableTypes.has('HIGH_WIND_ENVIRONMENTAL');
      const confidence = hasWind ? 0.88 : 0.70;
      const status = hasWind ? IncidentStatus.ASSESSING : IncidentStatus.DETECTED;

      const isSimulated = correlated.some((e) => e.sourceMode === SourceMode.SIMULATED);
      const sourceMode = isSimulated ? SourceMode.SIMULATED : SourceMode.LIVE;

      const centroid = calculateCentroid(correlated);
      const place = spot.payload?.place || `Sector [${centroid.lat.toFixed(2)}, ${centroid.lon.toFixed(2)}]`;

      hypotheses.push({
        id: `hyp-wildfire-${spot.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        hazardType: this.hazardType,
        title: `Thermal Hotspot / Wildfire Signal - ${place}`,
        description: `Active thermal anomaly detected near ${place}.${
          hasWind ? ' Correlated with high surface wind speed.' : ' Ambient wind conditions nominal.'
        }`,
        status,
        confidence,
        sourceMode,
        location: {
          lat: centroid.lat,
          lon: centroid.lon,
          name: place,
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
