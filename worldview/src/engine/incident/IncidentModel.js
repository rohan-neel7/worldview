import { IncidentStatus, SeverityLevel, SourceMode } from '../event/types.js';
import { validateTransition } from './IncidentStateMachine.js';

/**
 * Creates a Canonical Incident instance.
 *
 * @param {object} params
 * @returns {object} Canonical Incident object
 */
export function createIncident({
  id,
  title,
  type,
  status = IncidentStatus.DETECTED,
  severity = SeverityLevel.MODERATE,
  confidence = 0.5,
  sourceMode = SourceMode.LIVE,
  location = null,
  geometry = null,
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
  evidence = [],
  evidenceGaps = [],
  risk = null,
  impactData = null,
  lifecycleHistory = [],
}) {
  let finalGeometry = geometry;
  if (!finalGeometry && location && typeof location.lat === 'number' && typeof location.lon === 'number') {
    finalGeometry = {
      type: 'Point',
      coordinates: [location.lon, location.lat],
    };
  }

  const initialHistory = lifecycleHistory.length > 0
    ? [...lifecycleHistory]
    : [
        {
          fromStatus: null,
          toStatus: status,
          timestamp: createdAt,
          reason: `Initial incident detection (${title})`,
        },
      ];

  return {
    id: id || `inc-${type.toLowerCase()}-${Date.now()}`,
    title: title || `${type} Incident`,
    type,
    status,
    severity,
    confidence: Math.max(0.0, Math.min(1.0, typeof confidence === 'number' ? confidence : 0.5)),
    sourceMode,
    location: location || { lat: 0, lon: 0, name: 'Unknown Location', radiusKm: 25 },
    geometry: finalGeometry,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
    evidence: Array.isArray(evidence) ? [...evidence] : [],
    evidenceGaps: Array.isArray(evidenceGaps) ? [...evidenceGaps] : [],
    risk: risk || null,
    impactData: impactData || null,
    lifecycleHistory: initialHistory,
  };
}

/**
 * Transitions an incident to a new status with validation and history logging.
 *
 * @param {object} incident - The incident object to modify
 * @param {string} toStatus - New IncidentStatus
 * @param {string} reason - Justification for the status transition
 * @param {string} [timestamp=new Date().toISOString()]
 * @returns {object} Updated incident object
 */
export function transitionIncident(incident, toStatus, reason = '', timestamp = new Date().toISOString()) {
  if (!incident) throw new Error('transitionIncident requires an incident object');

  if (incident.status === toStatus) {
    return incident;
  }

  validateTransition(incident.status, toStatus);

  const updatedHistory = [
    ...(incident.lifecycleHistory || []),
    {
      fromStatus: incident.status,
      toStatus,
      timestamp,
      reason: reason || `Status updated from ${incident.status} to ${toStatus}`,
    },
  ];

  return {
    ...incident,
    status: toStatus,
    updatedAt: timestamp,
    lifecycleHistory: updatedHistory,
  };
}
