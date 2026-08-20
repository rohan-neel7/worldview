/**
 * Worldview Disaster Intelligence — Canonical Real-World Event Model
 *
 * Represents the deduplicated physical event determined by the correlation engine.
 *
 * Adheres to Phase 6C-H Rules:
 *   - Stable identity assigned by correlation engine, NOT grid hashing.
 *   - Preserves 100% of contributing raw observations with full provenance in sourceObservations[].
 *   - Explicit revisionHistory[] tracking provider magnitude/location updates.
 *   - Explicit conflicts[] preserving provider disagreements without silent averaging.
 *   - Strict separation of sourceMode (LIVE vs SIMULATED) and dataState.
 */

import { CorroborationLevel, SourceMode } from './types.js';
import { DataState } from '../providers/providerTypes.js';

let eventCounter = 1;

export class RealWorldEvent {
  /**
   * @param {object} params
   */
  constructor({
    id = null,
    hazardType,
    canonicalLocation,
    canonicalMagnitude = null,
    canonicalObservedAt = null,
    sourceObservations = [],
    revisionHistory = [],
    conflicts = [],
    corroborationLevel = CorroborationLevel.SINGLE_SOURCE,
    corroborationNotes = '',
    correlationAudit = [],
    sourceMode = SourceMode.LIVE,
    dataState = DataState.OBSERVED,
    isAmbiguous = false,
    ambiguityNotes = '',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    if (!hazardType || typeof hazardType !== 'string') {
      throw new Error('RealWorldEvent requires a valid string "hazardType"');
    }

    const typeLower = hazardType.toLowerCase();
    this.id = id || `rwe_${typeLower}_${Date.now()}_${eventCounter++}`;
    this.hazardType = hazardType.toUpperCase();

    this.canonicalLocation = {
      lat: Number(canonicalLocation?.lat) || 0,
      lon: Number(canonicalLocation?.lon) || 0,
      depthKm: canonicalLocation?.depthKm !== undefined ? Number(canonicalLocation.depthKm) : undefined,
      name: canonicalLocation?.name || 'Regional Hazard Sector',
      radiusKm: canonicalLocation?.radiusKm !== undefined ? Number(canonicalLocation.radiusKm) : 50,
    };

    this.canonicalMagnitude =
      typeof canonicalMagnitude === 'number' ? Number(canonicalMagnitude) : null;
    this.canonicalObservedAt = canonicalObservedAt || createdAt;
    this.lastObservedAt = updatedAt;

    this.sourceObservations = Array.isArray(sourceObservations) ? [...sourceObservations] : [];
    this.revisionHistory = Array.isArray(revisionHistory) ? [...revisionHistory] : [];
    this.conflicts = Array.isArray(conflicts) ? [...conflicts] : [];

    this.corroborationLevel = corroborationLevel;
    this.corroborationNotes = corroborationNotes;
    this.correlationAudit = Array.isArray(correlationAudit) ? [...correlationAudit] : [];

    this.sourceMode = sourceMode;
    this.dataState = sourceMode === SourceMode.SIMULATED ? DataState.SIMULATED : dataState;

    this.isAmbiguous = Boolean(isAmbiguous);
    this.ambiguityNotes = ambiguityNotes || '';

    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Incorporates a new correlated observation into this canonical RealWorldEvent.
   *
   * @param {object} newObs - Incoming CanonicalEvent
   * @param {object} correlationAudit - Result from correlation policy
   */
  addObservation(newObs, correlationAudit = null) {
    if (!newObs || !newObs.id) return;

    // Strict guard
    if ((newObs.sourceMode || SourceMode.LIVE) !== this.sourceMode) {
      throw new Error('STRICT ISOLATION: Cannot add observation with mismatched sourceMode.');
    }

    const existingObsIndex = this.sourceObservations.findIndex(
      (o) => o.id === newObs.id && (o.source || o.providerId) === (newObs.source || newObs.providerId)
    );

    const nowIso = new Date().toISOString();
    const newMag = newObs.payload?.magnitude ?? newObs.magnitude;
    const newDepth = newObs.location?.depthKm ?? newObs.payload?.depthKm;
    const newLoc = newObs.location;

    if (existingObsIndex >= 0) {
      // ── Provider Revision (Same provider event ID revised) ──
      const oldObs = this.sourceObservations[existingObsIndex];
      const oldMag = oldObs.payload?.magnitude ?? oldObs.magnitude;

      this.revisionHistory.push({
        timestamp: nowIso,
        providerId: newObs.source || newObs.providerId || 'UNKNOWN',
        eventId: newObs.id,
        previousMagnitude: oldMag,
        newMagnitude: newMag,
        previousLocation: { ...oldObs.location },
        newLocation: { ...newLoc },
        reason: `Provider telemetry revision received from ${newObs.source || 'upstream feed'}`,
      });

      // Update stored observation
      this.sourceObservations[existingObsIndex] = newObs;

      // Update canonical magnitude if revised
      if (typeof newMag === 'number') {
        this.canonicalMagnitude = newMag;
      }
    } else {
      // ── New Distinct Provider Observation ──
      this.sourceObservations.push(newObs);

      // Detect magnitude conflicts between different reporting providers
      if (typeof newMag === 'number' && typeof this.canonicalMagnitude === 'number') {
        const diff = Number(Math.abs(newMag - this.canonicalMagnitude).toFixed(2));
        if (diff >= 0.3) {
          const existingConflict = this.conflicts.find((c) => c.field === 'magnitude');
          if (!existingConflict) {
            this.conflicts.push({
              field: 'magnitude',
              difference: diff,
              threshold: 0.3,
              values: [
                { source: this.sourceObservations[0]?.source || 'PRIMARY', value: this.canonicalMagnitude },
                { source: newObs.source || 'SECONDARY', value: newMag },
              ],
              conflictNote: `Magnitude disagreement of ${diff} across reporting networks. Values preserved without averaging.`,
            });
          }
        }
      }

      // Canonical attribute updates (prefer latest authoritative / higher fidelity observation)
      if (this.canonicalMagnitude === null && typeof newMag === 'number') {
        this.canonicalMagnitude = newMag;
      }
    }

    // Update spatial centroid / canonical location
    if (newLoc && typeof newLoc.lat === 'number' && typeof newLoc.lon === 'number') {
      if (this.sourceObservations.length === 1) {
        this.canonicalLocation.lat = newLoc.lat;
        this.canonicalLocation.lon = newLoc.lon;
        this.canonicalLocation.depthKm = newDepth !== undefined ? newDepth : this.canonicalLocation.depthKm;
        this.canonicalLocation.name = newLoc.name || this.canonicalLocation.name;
      } else if (this.hazardType === 'WILDFIRE' || this.hazardType === 'FLOOD') {
        let sumLat = 0;
        let sumLon = 0;
        let count = 0;
        for (const obs of this.sourceObservations) {
          const l = obs.location || obs.canonicalLocation;
          if (l && typeof l.lat === 'number' && typeof l.lon === 'number') {
            sumLat += l.lat;
            sumLon += l.lon;
            count++;
          }
        }
        if (count > 0) {
          this.canonicalLocation.lat = Number((sumLat / count).toFixed(5));
          this.canonicalLocation.lon = Number((sumLon / count).toFixed(5));
        }
      }
    }

    if (correlationAudit) {
      this.correlationAudit.push({
        timestamp: nowIso,
        observationId: newObs.id,
        source: newObs.source,
        ...correlationAudit,
      });
    }

    // Recompute Corroboration Level
    this._recomputeCorroboration();

    this.lastObservedAt = newObs.observedAt || nowIso;
    this.updatedAt = nowIso;
  }

  _recomputeCorroboration() {
    const sources = Array.from(new Set(this.sourceObservations.map((o) => o.source || o.providerId || 'UNKNOWN')));
    const count = sources.length;

    if (this.conflicts.length > 0) {
      this.corroborationLevel = CorroborationLevel.CONFLICTING_SOURCES;
      this.corroborationNotes = `Conflicting observations detected across ${count} sources (${this.conflicts.map((c) => c.field).join(', ')}). Discrepancies preserved.`;
    } else if (count >= 2) {
      this.corroborationLevel = CorroborationLevel.CONFIRMED_BY_MULTIPLE_SOURCES;
      this.corroborationNotes = `Corroborated across ${count} independent reporting networks (${sources.join(', ')}).`;
    } else if (this.sourceObservations.length === 1 && (this.sourceObservations[0].confidence || 1.0) < 0.5) {
      this.corroborationLevel = CorroborationLevel.INSUFFICIENT_EVIDENCE;
      this.corroborationNotes = 'Single observation with low baseline confidence.';
    } else {
      this.corroborationLevel = CorroborationLevel.SINGLE_SOURCE;
      this.corroborationNotes = `Reported by single source (${sources[0] || 'Unknown'}).`;
    }
  }

  toJSON() {
    return {
      id: this.id,
      hazardType: this.hazardType,
      canonicalLocation: this.canonicalLocation,
      canonicalMagnitude: this.canonicalMagnitude,
      canonicalObservedAt: this.canonicalObservedAt,
      lastObservedAt: this.lastObservedAt,
      sourceObservations: this.sourceObservations,
      observationCount: this.sourceObservations.length,
      revisionHistory: this.revisionHistory,
      conflicts: this.conflicts,
      corroborationLevel: this.corroborationLevel,
      corroborationNotes: this.corroborationNotes,
      correlationAudit: this.correlationAudit,
      sourceMode: this.sourceMode,
      dataState: this.dataState,
      isAmbiguous: this.isAmbiguous,
      ambiguityNotes: this.ambiguityNotes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
