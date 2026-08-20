import { EventType, EvidenceRelevance, SourceMode, IncidentStatus } from '../../event/types.js';
import { EarthquakeImpactEngine } from '../../impact/EarthquakeImpactEngine.js';

export class EarthquakeIncidentRule {
  constructor(options = {}) {
    this.name = 'EarthquakeIncidentRule';
    this.hazardType = 'EARTHQUAKE';
    this.minMagnitude = options.minMagnitude !== undefined ? options.minMagnitude : 4.0;
    this.requiredEvidenceTypes = [
      'USGS_SEISMIC_TELEMETRY',
      'POPULATION_EXPOSURE_MODEL',
      'CRITICAL_INFRASTRUCTURE_INTERSECTION',
    ];
  }

  /**
   * Evaluates canonical earthquake events from USGS, computes impact, and creates incident hypotheses.
   *
   * @param {Array<object>} events - Normalized canonical events
   * @param {object} [_context={}]
   * @returns {Array<object>} Generated hypotheses
   */
  evaluate(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const hypotheses = [];

    const qualifyingQuakes = events.filter((e) => {
      if (e.type === EventType.EARTHQUAKE) {
        const mag = e.payload?.magnitude !== undefined ? e.payload.magnitude : 0;
        return mag >= this.minMagnitude;
      }
      return false;
    });

    for (const q of qualifyingQuakes) {
      const mag = q.payload?.magnitude || 4.5;
      const depth = q.location?.depthKm !== undefined ? q.location.depthKm : (q.payload?.depthKm || 10);
      const lat = q.location?.lat || 0;
      const lon = q.location?.lon || 0;
      const place = q.payload?.place || 'Regional Epicenter';
      const tsunamiFlag = Boolean(q.payload?.tsunamiFlag);

      // Deterministically evaluate impact and exposed assets
      const impact = EarthquakeImpactEngine.evaluate({
        magnitude: mag,
        depthKm: depth,
        lat,
        lon,
        place,
        tsunamiFlag,
      });

      const availableTypes = new Set(['USGS_SEISMIC_TELEMETRY', 'POPULATION_EXPOSURE_MODEL', 'CRITICAL_INFRASTRUCTURE_INTERSECTION']);

      // 1. Primary Hazard Evidence (USGS)
      const evidence = [
        {
          eventId: q.id,
          source: q.source || 'USGS',
          sourceMode: q.sourceMode || SourceMode.LIVE,
          type: q.type,
          timestamp: q.observedAt,
          relevance: EvidenceRelevance.PRIMARY_HAZARD,
          confidence: q.confidence || 0.95,
          relationship: `Authoritative USGS seismic observation (M${mag}, depth ${depth}km) near ${place}`,
          metrics: {
            magnitude: mag,
            depthKm: depth,
            significance: q.payload?.significance || 0,
            reviewStatus: q.payload?.reviewStatus || 'reviewed',
          },
        },
        {
          eventId: `${q.id}:impact-model`,
          source: 'Worldview Seismo-Attenuation Engine',
          sourceMode: q.sourceMode || SourceMode.LIVE,
          type: EventType.GENERIC_OBSERVATION,
          timestamp: q.observedAt,
          relevance: EvidenceRelevance.CORROBORATING_OBSERVATION,
          confidence: 0.90,
          relationship: `Calculated isoseismal zones: ${impact.shakingZones.severeRadiusKm}km severe, ${impact.shakingZones.moderateRadiusKm}km moderate. Estimated population exposure: ~${impact.exposureMetrics.populationExposed.toLocaleString()}.`,
          metrics: {
            populationExposed: impact.exposureMetrics.populationExposed,
            severeRadiusKm: impact.shakingZones.severeRadiusKm,
            moderateRadiusKm: impact.shakingZones.moderateRadiusKm,
            hospitalsCount: impact.exposureMetrics.hospitalsCount,
            airportsCount: impact.exposureMetrics.airportsCount,
            portsCount: impact.exposureMetrics.portsCount,
            roadsCount: impact.exposureMetrics.roadsCount,
            exposureScore: impact.exposureMetrics.exposureScore,
          },
        },
      ];

      // 2. Tsunami Corroboration / Flag Evidence
      if (tsunamiFlag) {
        availableTypes.add('NATIONAL_TSUNAMI_WARNING');
        evidence.push({
          eventId: `${q.id}:tsunami-flag`,
          source: q.source || 'USGS/NOAA',
          sourceMode: q.sourceMode || SourceMode.LIVE,
          type: EventType.GENERIC_OBSERVATION,
          timestamp: q.observedAt,
          relevance: EvidenceRelevance.CORROBORATING_OBSERVATION,
          confidence: 0.92,
          relationship: 'Automated tsunami advisory flag broadcast by upstream seismic network',
          metrics: { tsunamiFlag: true },
        });
      }

      // Check evidence gaps
      const allRequired = [...this.requiredEvidenceTypes];
      if (mag >= 6.5 && depth <= 70) {
        allRequired.push('DART_OCEAN_BUOY_TELEMETRY');
      }
      if (mag >= 6.0) {
        allRequired.push('SATELLITE_SAR_DAMAGE_PASS');
      }

      const evidenceGaps = allRequired.filter((t) => !availableTypes.has(t));

      // Determine initial incident lifecycle status
      let status = IncidentStatus.DETECTED;
      if (mag >= 6.5) {
        status = IncidentStatus.ACTIVE;
      } else if (mag >= 5.0) {
        status = IncidentStatus.CONFIRMED;
      }

      const baseConfidence = q.confidence || 0.95;

      hypotheses.push({
        id: `hyp-earthquake-${q.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        hazardType: this.hazardType,
        title: `M${mag.toFixed(1)} Earthquake - ${place}`,
        description: `Seismic event (M${mag.toFixed(1)}, depth ${depth}km) near ${place}. Estimated ${impact.exposureMetrics.populationExposed.toLocaleString()} people and ${impact.exposureMetrics.hospitalsCount} healthcare facilities within estimated isoseismal shaking zone.`,
        status,
        confidence: baseConfidence,
        sourceMode: q.sourceMode || SourceMode.LIVE,
        location: {
          lat,
          lon,
          name: place,
          depthKm: depth,
          radiusKm: impact.shakingZones.moderateRadiusKm || 50,
        },
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        evidence,
        evidenceGaps,
        correlatedEventIds: [q.id],
        impactData: impact,
      });
    }

    return hypotheses;
  }
}
