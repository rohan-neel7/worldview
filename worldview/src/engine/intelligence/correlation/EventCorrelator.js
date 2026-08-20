/**
 * Worldview Disaster Intelligence — Event Correlator
 *
 * Generic spatial, temporal, and semantic correlation layer.
 *
 * Adheres to Phase 6C Rules:
 *   - Correction #1: Configurable hazard-specific heuristics with documented rationale.
 *   - Correction #6 / Non-Negotiable 4: Preserves all contributing evidence with zero
 *     loss of provenance. Never replaces multiple sources with a single merged stub.
 *   - Correction #8: Separates source agreement into explicit corroboration levels and
 *     conflict records with zero silent averaging.
 */

import { haversineDistanceKm, calculateCentroid, temporalDiffMinutes } from '../../fusion/geoUtils.js';
import { CorroborationLevel, EventType } from '../../event/types.js';
import { CORRELATION_RULES } from './correlationRules.js';

export class EventCorrelator {
  /**
   * @param {object} [customRules={}] - Optional rule overrides
   */
  constructor(customRules = {}) {
    this.rules = { ...CORRELATION_RULES, ...customRules };
  }

  /**
   * Correlates canonical events into multi-source observation clusters.
   *
   * @param {Array<object>} events - Normalized CanonicalEvents
   * @param {object} [context={}]
   * @returns {Array<object>} Array of correlated observation clusters
   */
  correlate(events, context = {}) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const clusters = [];
    const unclustered = [...events];

    // Priority clustering: Quakes, Storms, Fires, Floods, Alerts
    while (unclustered.length > 0) {
      const seed = unclustered.shift();
      if (!seed || !seed.location) continue;

      const rule = this._getRuleForEvent(seed);
      const clusterEvents = [seed];
      const remaining = [];

      for (const candidate of unclustered) {
        if (this._matchesCluster(seed, candidate, rule, context)) {
          clusterEvents.push(candidate);
        } else {
          remaining.push(candidate);
        }
      }

      unclustered.length = 0;
      unclustered.push(...remaining);

      const cluster = this._buildCluster(clusterEvents, rule);
      clusters.push(cluster);
    }

    return clusters;
  }

  _getRuleForEvent(event) {
    const type = event.type;
    if (type === EventType.EARTHQUAKE || type === EventType.TSUNAMI_SIGNAL || type === EventType.SEISMIC_STATION_READING) {
      return this.rules.EARTHQUAKE;
    }
    if (type === EventType.WILDFIRE_HOTSPOT) {
      return this.rules.WILDFIRE;
    }
    if (type === EventType.FLOOD_SIGNAL || type === EventType.WATER_LEVEL_OBSERVATION) {
      return this.rules.FLOOD;
    }
    if (type === EventType.CYCLONE || type === EventType.HAZARD_TRACK) {
      return this.rules.CYCLONE;
    }
    if (type === EventType.OFFICIAL_WARNING) {
      const rawText = `${event.payload?.headline || ''} ${event.payload?.hazardType || ''}`.toUpperCase();
      if (rawText.includes('CYCLONE') || rawText.includes('STORM')) return this.rules.CYCLONE;
      if (rawText.includes('FLOOD') || rawText.includes('RAIN')) return this.rules.FLOOD;
      if (rawText.includes('QUAKE') || rawText.includes('TSUNAMI')) return this.rules.EARTHQUAKE;
      if (rawText.includes('FIRE')) return this.rules.WILDFIRE;
    }
    if (type === EventType.WEATHER) {
      if ((event.payload?.rainfallMm || 0) > 30) return this.rules.FLOOD;
      if ((event.payload?.windSpeedMps || 0) > 15) return this.rules.WILDFIRE;
    }
    return this.rules.GENERIC;
  }

  _matchesCluster(seed, candidate, rule, _context) {
    if (!seed.location || !candidate.location) return false;
    if (typeof seed.location.lat !== 'number' || typeof candidate.location.lat !== 'number') return false;

    // 1. Spatial proximity check
    const distKm = haversineDistanceKm(
      seed.location.lat,
      seed.location.lon,
      candidate.location.lat,
      candidate.location.lon
    );
    if (distKm > rule.spatialRadiusKm) {
      return false;
    }

    // 2. Temporal proximity check
    const timeDiffMin = temporalDiffMinutes(seed.observedAt, candidate.observedAt);
    if (timeDiffMin > rule.temporalWindowMinutes) {
      return false;
    }

    // 3. Type compatibility
    const candType = candidate.type;
    const isMatchingType = rule.matchingTypes.includes(candType);
    if (!isMatchingType && candType !== seed.type) {
      return false;
    }

    return true;
  }

  _buildCluster(events, rule) {
    const seed = events[0];
    const centroid = calculateCentroid(events);
    const eventIds = events.map((e) => e.id);
    const sources = Array.from(new Set(events.map((e) => e.source || 'UNKNOWN')));

    // Analyze source agreement and conflict detection
    const { corroborationLevel, conflicts, corroborationNotes } = this._evaluateAgreement(events, rule);

    const clusterId = `cluster_${rule.hazardType.toLowerCase()}_${seed.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return {
      clusterId,
      hazardType: rule.hazardType,
      seedEventId: seed.id,
      eventIds,
      events, // Preserves ALL contributing events with zero loss of provenance
      sources,
      sourceCount: sources.length,
      centroid,
      corroborationLevel,
      corroborationNotes,
      conflicts,
      ruleApplied: {
        hazardType: rule.hazardType,
        spatialRadiusKm: rule.spatialRadiusKm,
        temporalWindowMinutes: rule.temporalWindowMinutes,
        rationale: rule.rationale,
      },
    };
  }

  _evaluateAgreement(events, rule) {
    const sources = Array.from(new Set(events.map((e) => e.source || 'UNKNOWN')));
    const conflicts = [];

    // 1. Check for magnitude conflict in earthquakes
    if (rule.hazardType === 'EARTHQUAKE') {
      const magObs = events
        .filter((e) => e.type === EventType.EARTHQUAKE && e.payload?.magnitude != null)
        .map((e) => ({
          source: e.source,
          magnitude: Number(e.payload.magnitude),
          observedAt: e.observedAt,
        }));

      if (magObs.length >= 2) {
        const mags = magObs.map((m) => m.magnitude);
        const minMag = Math.min(...mags);
        const maxMag = Math.max(...mags);
        const diff = Number((maxMag - minMag).toFixed(2));

        if (diff >= (rule.magnitudeDeltaConflictThreshold || 0.3)) {
          conflicts.push({
            field: 'magnitude',
            difference: diff,
            threshold: rule.magnitudeDeltaConflictThreshold || 0.3,
            values: magObs.map((m) => ({ source: m.source, value: m.magnitude })),
            conflictNote: `Magnitude disagreement of ${diff} across reporting seismic networks. Values preserved without averaging.`,
          });
        }
      }
    }

    // Determine Corroboration Level
    let corroborationLevel = CorroborationLevel.SINGLE_SOURCE;
    let corroborationNotes = '';

    if (conflicts.length > 0) {
      corroborationLevel = CorroborationLevel.CONFLICTING_SOURCES;
      corroborationNotes = `Conflicting observations detected across ${sources.length} sources (${conflicts.map((c) => c.field).join(', ')}). Discrepancy preserved.`;
    } else if (sources.length >= 2) {
      corroborationLevel = CorroborationLevel.CONFIRMED_BY_MULTIPLE_SOURCES;
      corroborationNotes = `Corroborated across ${sources.length} independent reporting sources (${sources.join(', ')}).`;
    } else if (events.length === 1 && events[0].confidence < 0.5) {
      corroborationLevel = CorroborationLevel.INSUFFICIENT_EVIDENCE;
      corroborationNotes = 'Single observation with low confidence threshold.';
    } else {
      corroborationLevel = CorroborationLevel.SINGLE_SOURCE;
      corroborationNotes = `Reported by single source (${sources[0] || 'Unknown'}).`;
    }

    return { corroborationLevel, conflicts, corroborationNotes };
  }
}
