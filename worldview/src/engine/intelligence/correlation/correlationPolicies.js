/**
 * Worldview Disaster Intelligence — Correlation Policies & Heuristics
 *
 * Deterministic multi-factor composite correlation policies for disaster event identity.
 *
 * Adheres to Phase 6C-H Rules:
 *   - Configurable hazard-specific heuristics with documented rationale (WORLDVIEW CORRELATION HEURISTICS).
 *   - Continuous composite scoring evaluating spatial, temporal, magnitude, depth, and lineage.
 *   - Strict 3-way correlation states: MATCHED, SEPARATE, AMBIGUOUS (ambiguous events never silently merged).
 *   - Preserves complete correlation explanation for auditability.
 *   - STRICT LIVE/SYNTHETIC ISOLATION: Live and synthetic observations will NEVER merge (score = 0.0).
 */

import { haversineDistanceKm, temporalDiffMinutes } from '../../fusion/geoUtils.js';
import { EventType, SourceMode } from '../../event/types.js';

export const CorrelationDecision = Object.freeze({
  MATCHED: 'MATCHED',
  SEPARATE: 'SEPARATE',
  AMBIGUOUS: 'AMBIGUOUS',
});

/**
 * Base abstract class for hazard-specific correlation policies.
 */
export class BaseCorrelationPolicy {
  constructor(config = {}) {
    this.hazardType = config.hazardType || 'GENERIC';
    this.rationale = config.rationale || 'Default correlation policy.';
    this.matchThreshold = config.matchThreshold !== undefined ? config.matchThreshold : 0.75;
    this.separateThreshold = config.separateThreshold !== undefined ? config.separateThreshold : 0.45;
    this.candidateMaxRadiusKm = config.candidateMaxRadiusKm || 250.0;
    this.candidateMaxTimeDiffMin = config.candidateMaxTimeDiffMin || 180.0;
  }

  /**
   * Pre-filters whether two observations are plausible candidates for detailed correlation.
   *
   * @param {object} obs1
   * @param {object} obs2
   * @returns {boolean}
   */
  isCandidate(obs1, obs2) {
    const loc1 = obs1.location || obs1.canonicalLocation;
    const loc2 = obs2.location || obs2.canonicalLocation;
    if (!loc1 || !loc2) return false;
    if (typeof loc1.lat !== 'number' || typeof loc2.lat !== 'number') return false;

    // Strict Source Mode Isolation: Live + Synthetic NEVER merge
    const mode1 = obs1.sourceMode || SourceMode.LIVE;
    const mode2 = obs2.sourceMode || SourceMode.LIVE;
    if (mode1 !== mode2) return false;

    const distKm = haversineDistanceKm(loc1.lat, loc1.lon, loc2.lat, loc2.lon);
    if (distKm > this.candidateMaxRadiusKm) return false;

    const time1 = obs1.observedAt || obs1.canonicalObservedAt || new Date().toISOString();
    const time2 = obs2.observedAt || obs2.canonicalObservedAt || new Date().toISOString();
    const timeDiffMin = temporalDiffMinutes(time1, time2);
    if (timeDiffMin > this.candidateMaxTimeDiffMin) return false;

    return true;
  }

  /**
   * Evaluates composite correlation between two observations or an observation and a RealWorldEvent.
   *
   * @param {object} obs1 - New incoming observation
   * @param {object} obs2 - Existing observation or RealWorldEvent
   * @returns {{ decision: string, score: number, breakdown: object, rationale: string }}
   */
  evaluate(_obs1, _obs2) {
    throw new Error('evaluate() must be implemented by subclass');
  }
}

/**
 * Dedicated Earthquake Correlation Policy
 *
 * WORLDVIEW CORRELATION HEURISTICS:
 * - Teleseismic epicenter locations typically carry ±20-80km uncertainty across regional seismic arrays.
 * - Same-mainshock arrival signals correlate within 0-30 min.
 * - Focal depth uncertainty is typically within ±25-40km.
 * - Cross-network calibration magnitude differences <= 0.4 Mw represent source agreement; > 0.3 Mw triggers conflict flagging without averaging.
 */
export class EarthquakeCorrelationPolicy extends BaseCorrelationPolicy {
  constructor(config = {}) {
    super({
      hazardType: 'EARTHQUAKE',
      rationale:
        'WORLDVIEW CORRELATION HEURISTICS: Earthquake mainshock signals correlate within 100km and 30min windows with compatible focal depths and magnitudes.',
      matchThreshold: config.matchThreshold !== undefined ? config.matchThreshold : 0.75,
      separateThreshold: config.separateThreshold !== undefined ? config.separateThreshold : 0.45,
      candidateMaxRadiusKm: config.candidateMaxRadiusKm || 250.0,
      candidateMaxTimeDiffMin: config.candidateMaxTimeDiffMin || 120.0,
      ...config,
    });

    this.weights = {
      spatial: config.spatialWeight || 0.35,
      temporal: config.temporalWeight || 0.30,
      magnitude: config.magnitudeWeight || 0.20,
      depth: config.depthWeight || 0.15,
    };

    this.magnitudeConflictThreshold = config.magnitudeConflictThreshold || 0.3;
    this.matchingTypes = [
      EventType.EARTHQUAKE,
      EventType.SEISMIC_STATION_READING,
      EventType.TSUNAMI_SIGNAL,
      EventType.OFFICIAL_WARNING,
    ];
  }

  evaluate(obs1, obs2) {
    // 1. Strict Live vs Synthetic Guard
    const mode1 = obs1.sourceMode || SourceMode.LIVE;
    const mode2 = obs2.sourceMode || SourceMode.LIVE;
    if (mode1 !== mode2) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatial: 0, temporal: 0, magnitude: 0, depth: 0, lineage: 0 },
        rationale: 'STRICT ISOLATION: Synthetic/Simulated telemetry cannot merge with Live operational telemetry.',
      };
    }

    // Upstream Provider Lineage Check (Explicit provider revision match)
    const provId1 = obs1.id || obs1.providerEventId;
    const provId2 = obs2.id || obs2.providerEventId;
    const source1 = obs1.source || obs1.providerId;
    const source2 = obs2.source || obs2.providerId;

    const isExplicitProviderRevision =
      Boolean(provId1 && provId2 && provId1 === provId2 && source1 && source2 && source1 === source2);

    // 2. Spatial & Temporal Coordinates
    const lat1 = obs1.location?.lat ?? obs1.canonicalLocation?.lat;
    const lon1 = obs1.location?.lon ?? obs1.canonicalLocation?.lon;
    const lat2 = obs2.location?.lat ?? obs2.canonicalLocation?.lat;
    const lon2 = obs2.location?.lon ?? obs2.canonicalLocation?.lon;

    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
      return {
        decision: isExplicitProviderRevision ? CorrelationDecision.MATCHED : CorrelationDecision.SEPARATE,
        score: isExplicitProviderRevision ? 1.0 : 0.0,
        breakdown: { spatial: 0, temporal: 0, magnitude: 0, depth: 0, isExplicitProviderRevision },
        rationale: isExplicitProviderRevision ? 'Matched via explicit upstream provider revision.' : 'Missing geospatial coordinates.',
      };
    }

    const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
    const time1 = obs1.observedAt || obs1.canonicalObservedAt || new Date().toISOString();
    const time2 = obs2.observedAt || obs2.canonicalObservedAt || new Date().toISOString();
    const timeDiffMin = temporalDiffMinutes(time1, time2);

    // Hard physical distance / time boundary gating (unless explicit provider revision)
    if (!isExplicitProviderRevision) {
      if (distKm > this.candidateMaxRadiusKm || timeDiffMin > this.candidateMaxTimeDiffMin) {
        return {
          decision: CorrelationDecision.SEPARATE,
          score: 0.0,
          breakdown: { spatial: 0, temporal: 0, distKm, timeDiffMin, isExplicitProviderRevision },
          rationale: `Physical separation exceeds maximum candidate envelope: ${distKm.toFixed(1)}km, ${timeDiffMin.toFixed(1)}m.`,
        };
      }
    }

    const spatialSim = Math.max(0.0, Math.min(1.0, 1.0 - distKm / 100.0));
    const temporalSim = Math.max(0.0, Math.min(1.0, 1.0 - timeDiffMin / 30.0));

    // If completely outside normal spatial or temporal radius and not explicit revision, it is SEPARATE
    if (!isExplicitProviderRevision && (spatialSim <= 0 || temporalSim <= 0)) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatialSimilarity: spatialSim, temporalSimilarity: temporalSim, distKm, timeDiffMin, isExplicitProviderRevision },
        rationale: `Spatial or temporal window exceeded: ${distKm.toFixed(1)}km, ${timeDiffMin.toFixed(1)}m separation.`,
      };
    }

    // 4. Magnitude Similarity (0 to 1) — linear decay to 0.6 delta
    const mag1 = obs1.payload?.magnitude ?? obs1.canonicalMagnitude ?? obs1.magnitude;
    const mag2 = obs2.payload?.magnitude ?? obs2.canonicalMagnitude ?? obs2.magnitude;
    let magSim = 1.0;
    let magDiff = 0;
    if (typeof mag1 === 'number' && typeof mag2 === 'number') {
      magDiff = Math.abs(mag1 - mag2);
      magSim = Math.max(0.0, Math.min(1.0, 1.0 - magDiff / 0.6));
    }

    // 5. Depth Similarity (0 to 1) — linear decay to 50km delta
    const depth1 = obs1.location?.depthKm ?? obs1.payload?.depthKm ?? obs1.canonicalLocation?.depthKm ?? 10;
    const depth2 = obs2.location?.depthKm ?? obs2.payload?.depthKm ?? obs2.canonicalLocation?.depthKm ?? 10;
    let depthSim = 1.0;
    let depthDiff = 0;
    if (typeof depth1 === 'number' && typeof depth2 === 'number') {
      depthDiff = Math.abs(depth1 - depth2);
      depthSim = Math.max(0.0, Math.min(1.0, 1.0 - depthDiff / 50.0));
    }

    let lineageBoost = isExplicitProviderRevision ? 0.35 : 0.0;

    // Composite Weighted Score
    const rawScore =
      spatialSim * this.weights.spatial +
      temporalSim * this.weights.temporal +
      magSim * this.weights.magnitude +
      depthSim * this.weights.depth +
      lineageBoost;

    const finalScore = Number(Math.max(0.0, Math.min(1.0, rawScore)).toFixed(3));

    // Decision Determination
    let decision = CorrelationDecision.SEPARATE;
    if (finalScore >= this.matchThreshold || isExplicitProviderRevision) {
      decision = CorrelationDecision.MATCHED;
    } else if (finalScore >= this.separateThreshold) {
      decision = CorrelationDecision.AMBIGUOUS;
    }

    const rationale =
      decision === CorrelationDecision.MATCHED
        ? `Matched physical earthquake: ${distKm.toFixed(1)}km distance (sim: ${spatialSim.toFixed(2)}), ${timeDiffMin.toFixed(1)}m time diff (sim: ${temporalSim.toFixed(2)}), ΔM: ${magDiff.toFixed(2)}, Δdepth: ${depthDiff.toFixed(1)}km. Score: ${finalScore}.`
        : decision === CorrelationDecision.AMBIGUOUS
        ? `Ambiguous correlation (score: ${finalScore}): ${distKm.toFixed(1)}km, ${timeDiffMin.toFixed(1)}m diff. Candidate preserved as separate event with ambiguity flag.`
        : `Distinct physical phenomenon (score: ${finalScore}): ${distKm.toFixed(1)}km distance, ${timeDiffMin.toFixed(1)}m separation exceeds threshold.`;

    return {
      decision,
      score: finalScore,
      breakdown: {
        spatialSimilarity: Number(spatialSim.toFixed(3)),
        temporalSimilarity: Number(temporalSim.toFixed(3)),
        magnitudeSimilarity: Number(magSim.toFixed(3)),
        depthSimilarity: Number(depthSim.toFixed(3)),
        distKm: Number(distKm.toFixed(1)),
        timeDiffMin: Number(timeDiffMin.toFixed(1)),
        magnitudeDiff: Number(magDiff.toFixed(2)),
        depthDiffKm: Number(depthDiff.toFixed(1)),
        isExplicitProviderRevision,
      },
      rationale,
    };
  }
}

/**
 * Dedicated Wildfire Hotspot Correlation Policy
 */
export class WildfireCorrelationPolicy extends BaseCorrelationPolicy {
  constructor(config = {}) {
    super({
      hazardType: 'WILDFIRE',
      rationale:
        'WORLDVIEW CORRELATION HEURISTICS: NASA FIRMS active fire pixels within 25km and 12 hours represent a single continuous wildfire complex.',
      matchThreshold: config.matchThreshold !== undefined ? config.matchThreshold : 0.70,
      separateThreshold: config.separateThreshold !== undefined ? config.separateThreshold : 0.40,
      candidateMaxRadiusKm: config.candidateMaxRadiusKm || 50.0,
      candidateMaxTimeDiffMin: config.candidateMaxTimeDiffMin || 720.0, // 12 hours
      ...config,
    });
    this.matchingTypes = [EventType.WILDFIRE_HOTSPOT, EventType.WEATHER];
  }

  evaluate(obs1, obs2) {
    const mode1 = obs1.sourceMode || SourceMode.LIVE;
    const mode2 = obs2.sourceMode || SourceMode.LIVE;
    if (mode1 !== mode2) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatial: 0, temporal: 0 },
        rationale: 'STRICT ISOLATION: Synthetic fire telemetry cannot merge with Live telemetry.',
      };
    }

    const lat1 = obs1.location?.lat ?? obs1.canonicalLocation?.lat;
    const lon1 = obs1.location?.lon ?? obs1.canonicalLocation?.lon;
    const lat2 = obs2.location?.lat ?? obs2.canonicalLocation?.lat;
    const lon2 = obs2.location?.lon ?? obs2.canonicalLocation?.lon;

    const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
    const time1 = obs1.observedAt || obs1.canonicalObservedAt || new Date().toISOString();
    const time2 = obs2.observedAt || obs2.canonicalObservedAt || new Date().toISOString();
    const timeDiffMin = temporalDiffMinutes(time1, time2);

    if (distKm > this.candidateMaxRadiusKm || timeDiffMin > this.candidateMaxTimeDiffMin) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatialSimilarity: 0, temporalSimilarity: 0, distKm, timeDiffMin },
        rationale: 'Separation exceeds maximum wildfire candidate radius or temporal window.',
      };
    }

    const spatialSim = Math.max(0.0, Math.min(1.0, 1.0 - distKm / 25.0));
    const temporalSim = Math.max(0.0, Math.min(1.0, 1.0 - timeDiffMin / 720.0));

    const finalScore = Number((spatialSim * 0.6 + temporalSim * 0.4).toFixed(3));

    let decision = CorrelationDecision.SEPARATE;
    if (finalScore >= this.matchThreshold) {
      decision = CorrelationDecision.MATCHED;
    } else if (finalScore >= this.separateThreshold) {
      decision = CorrelationDecision.AMBIGUOUS;
    }

    return {
      decision,
      score: finalScore,
      breakdown: {
        spatialSimilarity: spatialSim,
        temporalSimilarity: temporalSim,
        distKm: Number(distKm.toFixed(1)),
        timeDiffMin: Number(timeDiffMin.toFixed(1)),
      },
      rationale: `Wildfire cluster evaluation: ${distKm.toFixed(1)}km, ${timeDiffMin.toFixed(1)}m diff. Score: ${finalScore} → ${decision}.`,
    };
  }
}

/**
 * Dedicated Flood Correlation Policy
 */
export class FloodCorrelationPolicy extends BaseCorrelationPolicy {
  constructor(config = {}) {
    super({
      hazardType: 'FLOOD',
      rationale:
        'WORLDVIEW CORRELATION HEURISTICS: Hydrological runoff basin events correlate within 35km and 24 hours of accumulated precipitation.',
      matchThreshold: config.matchThreshold !== undefined ? config.matchThreshold : 0.70,
      separateThreshold: config.separateThreshold !== undefined ? config.separateThreshold : 0.40,
      candidateMaxRadiusKm: config.candidateMaxRadiusKm || 60.0,
      candidateMaxTimeDiffMin: config.candidateMaxTimeDiffMin || 1440.0, // 24 hours
      ...config,
    });
    this.matchingTypes = [
      EventType.FLOOD_SIGNAL,
      EventType.WEATHER,
      EventType.WATER_LEVEL_OBSERVATION,
      EventType.OFFICIAL_WARNING,
    ];
  }

  evaluate(obs1, obs2) {
    const mode1 = obs1.sourceMode || SourceMode.LIVE;
    const mode2 = obs2.sourceMode || SourceMode.LIVE;
    if (mode1 !== mode2) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatial: 0, temporal: 0 },
        rationale: 'STRICT ISOLATION: Synthetic flood telemetry cannot merge with Live telemetry.',
      };
    }

    const lat1 = obs1.location?.lat ?? obs1.canonicalLocation?.lat;
    const lon1 = obs1.location?.lon ?? obs1.canonicalLocation?.lon;
    const lat2 = obs2.location?.lat ?? obs2.canonicalLocation?.lat;
    const lon2 = obs2.location?.lon ?? obs2.canonicalLocation?.lon;

    const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
    const time1 = obs1.observedAt || obs1.canonicalObservedAt || new Date().toISOString();
    const time2 = obs2.observedAt || obs2.canonicalObservedAt || new Date().toISOString();
    const timeDiffMin = temporalDiffMinutes(time1, time2);

    if (distKm > this.candidateMaxRadiusKm || timeDiffMin > this.candidateMaxTimeDiffMin) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatialSimilarity: 0, temporalSimilarity: 0, distKm, timeDiffMin },
        rationale: 'Separation exceeds flood catchment envelope.',
      };
    }

    const spatialSim = Math.max(0.0, Math.min(1.0, 1.0 - distKm / 35.0));
    const temporalSim = Math.max(0.0, Math.min(1.0, 1.0 - timeDiffMin / 1440.0));

    const finalScore = Number((spatialSim * 0.55 + temporalSim * 0.45).toFixed(3));

    let decision = CorrelationDecision.SEPARATE;
    if (finalScore >= this.matchThreshold) {
      decision = CorrelationDecision.MATCHED;
    } else if (finalScore >= this.separateThreshold) {
      decision = CorrelationDecision.AMBIGUOUS;
    }

    return {
      decision,
      score: finalScore,
      breakdown: {
        spatialSimilarity: spatialSim,
        temporalSimilarity: temporalSim,
        distKm: Number(distKm.toFixed(1)),
        timeDiffMin: Number(timeDiffMin.toFixed(1)),
      },
      rationale: `Flood basin correlation: ${distKm.toFixed(1)}km, ${timeDiffMin.toFixed(1)}m diff. Score: ${finalScore} → ${decision}.`,
    };
  }
}

/**
 * Dedicated Cyclone Correlation Policy
 */
export class CycloneCorrelationPolicy extends BaseCorrelationPolicy {
  constructor(config = {}) {
    super({
      hazardType: 'CYCLONE',
      rationale:
        'WORLDVIEW CORRELATION HEURISTICS: Tropical cyclonic wind fields span 350km and multi-day cyclogenesis tracks correlate across 48h windows.',
      matchThreshold: config.matchThreshold !== undefined ? config.matchThreshold : 0.70,
      separateThreshold: config.separateThreshold !== undefined ? config.separateThreshold : 0.40,
      candidateMaxRadiusKm: config.candidateMaxRadiusKm || 500.0,
      candidateMaxTimeDiffMin: config.candidateMaxTimeDiffMin || 2880.0, // 48 hours
      ...config,
    });
    this.matchingTypes = [EventType.CYCLONE, EventType.HAZARD_TRACK, EventType.WEATHER, EventType.OFFICIAL_WARNING];
  }

  evaluate(obs1, obs2) {
    const mode1 = obs1.sourceMode || SourceMode.LIVE;
    const mode2 = obs2.sourceMode || SourceMode.LIVE;
    if (mode1 !== mode2) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatial: 0, temporal: 0 },
        rationale: 'STRICT ISOLATION: Synthetic cyclone telemetry cannot merge with Live telemetry.',
      };
    }

    const lat1 = obs1.location?.lat ?? obs1.canonicalLocation?.lat;
    const lon1 = obs1.location?.lon ?? obs1.canonicalLocation?.lon;
    const lat2 = obs2.location?.lat ?? obs2.canonicalLocation?.lat;
    const lon2 = obs2.location?.lon ?? obs2.canonicalLocation?.lon;

    const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
    const time1 = obs1.observedAt || obs1.canonicalObservedAt || new Date().toISOString();
    const time2 = obs2.observedAt || obs2.canonicalObservedAt || new Date().toISOString();
    const timeDiffMin = temporalDiffMinutes(time1, time2);

    if (distKm > this.candidateMaxRadiusKm || timeDiffMin > this.candidateMaxTimeDiffMin) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatialSimilarity: 0, temporalSimilarity: 0, distKm, timeDiffMin },
        rationale: 'Separation exceeds cyclone track circulation envelope.',
      };
    }

    const spatialSim = Math.max(0.0, Math.min(1.0, 1.0 - distKm / 350.0));
    const temporalSim = Math.max(0.0, Math.min(1.0, 1.0 - timeDiffMin / 2880.0));

    const finalScore = Number((spatialSim * 0.5 + temporalSim * 0.5).toFixed(3));

    let decision = CorrelationDecision.SEPARATE;
    if (finalScore >= this.matchThreshold) {
      decision = CorrelationDecision.MATCHED;
    } else if (finalScore >= this.separateThreshold) {
      decision = CorrelationDecision.AMBIGUOUS;
    }

    return {
      decision,
      score: finalScore,
      breakdown: {
        spatialSimilarity: spatialSim,
        temporalSimilarity: temporalSim,
        distKm: Number(distKm.toFixed(1)),
        timeDiffMin: Number(timeDiffMin.toFixed(1)),
      },
      rationale: `Cyclone track correlation: ${distKm.toFixed(1)}km, ${timeDiffMin.toFixed(1)}m diff. Score: ${finalScore} → ${decision}.`,
    };
  }
}

/**
 * Generic Fallback Correlation Policy
 */
export class GenericCorrelationPolicy extends BaseCorrelationPolicy {
  constructor(config = {}) {
    super({
      hazardType: 'GENERIC',
      rationale: 'Conservative spatial and temporal envelope for unclassified physical observations.',
      matchThreshold: config.matchThreshold !== undefined ? config.matchThreshold : 0.75,
      separateThreshold: config.separateThreshold !== undefined ? config.separateThreshold : 0.45,
      candidateMaxRadiusKm: config.candidateMaxRadiusKm || 30.0,
      candidateMaxTimeDiffMin: config.candidateMaxTimeDiffMin || 180.0,
      ...config,
    });
    this.matchingTypes = [EventType.GENERIC_OBSERVATION];
  }

  evaluate(obs1, obs2) {
    const mode1 = obs1.sourceMode || SourceMode.LIVE;
    const mode2 = obs2.sourceMode || SourceMode.LIVE;
    if (mode1 !== mode2) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatial: 0, temporal: 0 },
        rationale: 'STRICT ISOLATION: Synthetic telemetry cannot merge with Live telemetry.',
      };
    }

    const lat1 = obs1.location?.lat ?? obs1.canonicalLocation?.lat;
    const lon1 = obs1.location?.lon ?? obs1.canonicalLocation?.lon;
    const lat2 = obs2.location?.lat ?? obs2.canonicalLocation?.lat;
    const lon2 = obs2.location?.lon ?? obs2.canonicalLocation?.lon;

    const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
    const time1 = obs1.observedAt || obs1.canonicalObservedAt || new Date().toISOString();
    const time2 = obs2.observedAt || obs2.canonicalObservedAt || new Date().toISOString();
    const timeDiffMin = temporalDiffMinutes(time1, time2);

    if (distKm > this.candidateMaxRadiusKm || timeDiffMin > this.candidateMaxTimeDiffMin) {
      return {
        decision: CorrelationDecision.SEPARATE,
        score: 0.0,
        breakdown: { spatialSimilarity: 0, temporalSimilarity: 0, distKm, timeDiffMin },
        rationale: 'Separation exceeds generic candidate envelope.',
      };
    }

    const spatialSim = Math.max(0.0, Math.min(1.0, 1.0 - distKm / 30.0));
    const temporalSim = Math.max(0.0, Math.min(1.0, 1.0 - timeDiffMin / 180.0));
    const finalScore = Number((spatialSim * 0.5 + temporalSim * 0.5).toFixed(3));

    let decision = CorrelationDecision.SEPARATE;
    if (finalScore >= this.matchThreshold) {
      decision = CorrelationDecision.MATCHED;
    } else if (finalScore >= this.separateThreshold) {
      decision = CorrelationDecision.AMBIGUOUS;
    }

    return {
      decision,
      score: finalScore,
      breakdown: {
        spatialSimilarity: spatialSim,
        temporalSimilarity: temporalSim,
        distKm: Number(distKm.toFixed(1)),
        timeDiffMin: Number(timeDiffMin.toFixed(1)),
      },
      rationale: `Generic correlation: ${distKm.toFixed(1)}km, ${timeDiffMin.toFixed(1)}m diff. Score: ${finalScore} → ${decision}.`,
    };
  }
}

export const CORRELATION_POLICIES = Object.freeze({
  EARTHQUAKE: new EarthquakeCorrelationPolicy(),
  WILDFIRE: new WildfireCorrelationPolicy(),
  FLOOD: new FloodCorrelationPolicy(),
  CYCLONE: new CycloneCorrelationPolicy(),
  GENERIC: new GenericCorrelationPolicy(),
});
