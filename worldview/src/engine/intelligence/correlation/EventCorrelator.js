/**
 * Worldview Disaster Intelligence — Event Correlator
 *
 * Deterministic spatial, temporal, and semantic correlation layer.
 * Transforms raw provider observations into canonical RealWorldEvent clusters.
 *
 * Adheres to Phase 6C-H Rules:
 *   - Continuous composite scoring via hazard-specific correlation policies.
 *   - Explicit 3-way correlation decision states: MATCHED, SEPARATE, AMBIGUOUS.
 *   - Canonical RealWorldEvent identity determined by the correlation engine.
 *   - STRICT LIVE/SYNTHETIC ISOLATION: LIVE + SYNTHETIC → NEVER MERGE.
 *   - Preserves 100% of contributing raw observations in sourceObservations[].
 *   - Preserves explicit provider revisions and source conflicts without silent averaging.
 */

import { calculateCentroid } from '../../fusion/geoUtils.js';
import { EventType, SourceMode } from '../../event/types.js';
import { CORRELATION_POLICIES, CorrelationDecision } from './correlationPolicies.js';
import { RealWorldEvent } from '../../event/RealWorldEvent.js';

export class EventCorrelator {
  /**
   * @param {object} [customPolicies={}] - Optional policy overrides
   */
  constructor(customPolicies = {}) {
    this.policies = { ...CORRELATION_POLICIES, ...customPolicies };
    this.realWorldEvents = new Map(); // Map<rweId, RealWorldEvent>
  }

  /**
   * Correlates canonical observations into deduplicated RealWorldEvent clusters.
   *
   * @param {Array<object>} events - Normalized CanonicalEvents
   * @param {object} [context={}]
   * @returns {Array<object>} Array of correlated observation clusters / RealWorldEvents
   */
  correlate(events = [], _context = {}) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const matchedRweIdsInBatch = new Set();

    // 1. Process each incoming observation
    for (const obs of events) {
      if (!obs || !obs.location || typeof obs.location.lat !== 'number' || typeof obs.location.lon !== 'number') {
        continue;
      }

      const policy = this._getPolicyForEvent(obs);
      const obsMode = obs.sourceMode || SourceMode.LIVE;

      // Check if obs with same ID already belongs to an existing RealWorldEvent
      let existingOwner = null;
      for (const rwe of this.realWorldEvents.values()) {
        if (rwe.sourceMode !== obsMode) continue;
        if (
          rwe.sourceObservations.some(
            (o) => o.id === obs.id && (o.source || o.providerId) === (obs.source || obs.providerId)
          )
        ) {
          existingOwner = rwe;
          break;
        }
      }

      if (existingOwner) {
        existingOwner.addObservation(obs, { decision: CorrelationDecision.MATCHED, score: 1.0 });
        matchedRweIdsInBatch.add(existingOwner.id);
        continue;
      }

      // Find candidate RealWorldEvents already in working memory
      let bestMatch = null;
      let bestScore = -1;
      let bestEvaluation = null;

      for (const rwe of this.realWorldEvents.values()) {
        // Strict live/synthetic isolation check
        if (rwe.sourceMode !== obsMode) continue;
        if (rwe.hazardType !== policy.hazardType && !this._isCrossTypeCompatible(obs.type, rwe.hazardType)) {
          continue;
        }

        if (policy.isCandidate(obs, rwe)) {
          const evalResult = policy.evaluate(obs, rwe);
          if (evalResult.decision === CorrelationDecision.MATCHED && evalResult.score > bestScore) {
            bestScore = evalResult.score;
            bestMatch = rwe;
            bestEvaluation = evalResult;
          }
        }
      }

      if (bestMatch && bestEvaluation) {
        // ── MATCHED: Update existing canonical RealWorldEvent ──
        bestMatch.addObservation(obs, bestEvaluation);
        matchedRweIdsInBatch.add(bestMatch.id);
      } else {
        // Evaluate for AMBIGUOUS candidate (to flag without silently merging)
        let ambiguousCandidate = null;
        for (const rwe of this.realWorldEvents.values()) {
          if (rwe.sourceMode !== obsMode) continue;
          if (policy.isCandidate(obs, rwe)) {
            const evalResult = policy.evaluate(obs, rwe);
            if (evalResult.decision === CorrelationDecision.AMBIGUOUS) {
              ambiguousCandidate = { rwe, evalResult };
              break;
            }
          }
        }

        const isAmbiguous = Boolean(ambiguousCandidate);
        const ambiguityNotes = ambiguousCandidate
          ? `Ambiguous correlation with ${ambiguousCandidate.rwe.id} (${ambiguousCandidate.evalResult.rationale}). Preserved as distinct event.`
          : '';

        // ── SEPARATE / AMBIGUOUS: Create new RealWorldEvent ──
        const initialMag = obs.payload?.magnitude ?? obs.magnitude;
        const initialDepth = obs.location?.depthKm ?? obs.payload?.depthKm ?? 10;

        const newRwe = new RealWorldEvent({
          hazardType: policy.hazardType,
          canonicalLocation: {
            lat: obs.location.lat,
            lon: obs.location.lon,
            depthKm: initialDepth,
            name: obs.location.name || obs.payload?.place || 'Regional Epicenter',
          },
          canonicalMagnitude: typeof initialMag === 'number' ? initialMag : null,
          canonicalObservedAt: obs.observedAt,
          sourceObservations: [obs],
          sourceMode: obsMode,
          dataState: obs.dataState,
          isAmbiguous,
          ambiguityNotes,
        });

        this.realWorldEvents.set(newRwe.id, newRwe);
        matchedRweIdsInBatch.add(newRwe.id);
      }
    }

    // 2. Build cluster representations for all active RealWorldEvents in this batch
    const clusters = [];
    for (const rweId of matchedRweIdsInBatch) {
      const rwe = this.realWorldEvents.get(rweId);
      if (rwe) {
        clusters.push(this._buildClusterFromRwe(rwe));
      }
    }

    return clusters;
  }

  _getPolicyForEvent(event) {
    const type = event.type;
    if (
      type === EventType.EARTHQUAKE ||
      type === EventType.TSUNAMI_SIGNAL ||
      type === EventType.SEISMIC_STATION_READING
    ) {
      return this.policies.EARTHQUAKE;
    }
    if (type === EventType.WILDFIRE_HOTSPOT) {
      return this.policies.WILDFIRE;
    }
    if (type === EventType.FLOOD_SIGNAL || type === EventType.WATER_LEVEL_OBSERVATION) {
      return this.policies.FLOOD;
    }
    if (type === EventType.CYCLONE || type === EventType.HAZARD_TRACK) {
      return this.policies.CYCLONE;
    }
    if (type === EventType.OFFICIAL_WARNING) {
      const rawText = `${event.payload?.headline || ''} ${event.payload?.hazardType || ''}`.toUpperCase();
      if (rawText.includes('CYCLONE') || rawText.includes('STORM')) return this.policies.CYCLONE;
      if (rawText.includes('FLOOD') || rawText.includes('RAIN')) return this.policies.FLOOD;
      if (rawText.includes('QUAKE') || rawText.includes('TSUNAMI')) return this.policies.EARTHQUAKE;
      if (rawText.includes('FIRE')) return this.policies.WILDFIRE;
    }
    if (type === EventType.WEATHER) {
      const rain = event.payload?.rainfallMm ?? event.payload?.precipitationMm ?? 0;
      if (rain > 30) return this.policies.FLOOD;
      if ((event.payload?.windSpeedMps || 0) > 15) return this.policies.WILDFIRE;
    }
    return this.policies.GENERIC;
  }

  _isCrossTypeCompatible(obsType, rweHazardType) {
    if (rweHazardType === 'EARTHQUAKE') {
      return (
        obsType === EventType.TSUNAMI_SIGNAL ||
        obsType === EventType.SEISMIC_STATION_READING ||
        obsType === EventType.OFFICIAL_WARNING
      );
    }
    if (rweHazardType === 'FLOOD') {
      return (
        obsType === EventType.WATER_LEVEL_OBSERVATION ||
        obsType === EventType.WEATHER ||
        obsType === EventType.OFFICIAL_WARNING
      );
    }
    if (rweHazardType === 'WILDFIRE') {
      return obsType === EventType.WEATHER;
    }
    if (rweHazardType === 'CYCLONE') {
      return (
        obsType === EventType.HAZARD_TRACK ||
        obsType === EventType.WEATHER ||
        obsType === EventType.OFFICIAL_WARNING
      );
    }
    return false;
  }

  _buildClusterFromRwe(rwe) {
    const events = rwe.sourceObservations;
    const seed = events[0] || {};
    const centroid = events.length > 0 ? calculateCentroid(events) : rwe.canonicalLocation;
    const eventIds = events.map((e) => e.id);
    const sources = Array.from(new Set(events.map((e) => e.source || e.providerId || 'UNKNOWN')));
    const policy = this.policies[rwe.hazardType] || this.policies.GENERIC;

    return {
      clusterId: `cluster_${rwe.hazardType.toLowerCase()}_${rwe.id}`,
      realWorldEventId: rwe.id,
      realWorldEvent: rwe,
      hazardType: rwe.hazardType,
      seedEventId: seed.id || rwe.id,
      eventIds,
      events, // Preserves ALL contributing events with zero loss of provenance
      sources,
      sourceCount: sources.length,
      centroid,
      canonicalMagnitude: rwe.canonicalMagnitude,
      canonicalLocation: rwe.canonicalLocation,
      corroborationLevel: rwe.corroborationLevel,
      corroborationNotes: rwe.corroborationNotes,
      conflicts: rwe.conflicts,
      revisionHistory: rwe.revisionHistory,
      correlationAudit: rwe.correlationAudit,
      isAmbiguous: rwe.isAmbiguous,
      ambiguityNotes: rwe.ambiguityNotes,
      sourceMode: rwe.sourceMode,
      dataState: rwe.dataState,
      ruleApplied: {
        hazardType: policy.hazardType,
        matchThreshold: policy.matchThreshold,
        separateThreshold: policy.separateThreshold,
        rationale: policy.rationale,
      },
    };
  }

  /**
   * Clears in-memory real world event state.
   */
  clear() {
    this.realWorldEvents.clear();
  }

  /**
   * Retrieves all canonical RealWorldEvents in memory.
   */
  getRealWorldEvents() {
    return Array.from(this.realWorldEvents.values());
  }
}
