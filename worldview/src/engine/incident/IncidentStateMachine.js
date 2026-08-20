import { IncidentStatus } from '../event/types.js';

/**
 * Incident State Machine definition and transition validator.
 *
 * Valid transitions:
 * DETECTED  -> ASSESSING | DISMISSED
 * ASSESSING -> CONFIRMED | ACTIVE | DISMISSED
 * CONFIRMED -> ACTIVE | RESOLVED | DISMISSED
 * ACTIVE    -> RESOLVED | ASSESSING
 * RESOLVED  -> ACTIVE (re-escalation upon new high-severity telemetry)
 * DISMISSED -> DETECTED (re-evaluation upon novel sensor evidence)
 */
const VALID_TRANSITIONS = {
  [IncidentStatus.DETECTED]: [IncidentStatus.ASSESSING, IncidentStatus.DISMISSED],
  [IncidentStatus.ASSESSING]: [IncidentStatus.CONFIRMED, IncidentStatus.ACTIVE, IncidentStatus.DISMISSED],
  [IncidentStatus.CONFIRMED]: [IncidentStatus.ACTIVE, IncidentStatus.RESOLVED, IncidentStatus.DISMISSED],
  [IncidentStatus.ACTIVE]: [IncidentStatus.RESOLVED, IncidentStatus.ASSESSING],
  [IncidentStatus.RESOLVED]: [IncidentStatus.ACTIVE],
  [IncidentStatus.DISMISSED]: [IncidentStatus.DETECTED],
};

/**
 * Checks if a transition between incident statuses is permissible.
 *
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {boolean}
 */
export function canTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  const allowed = VALID_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

/**
 * Validates a transition and returns an error if illegal.
 *
 * @param {string} fromStatus
 * @param {string} toStatus
 * @throws {Error} if transition is invalid
 */
export function validateTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(
      `Illegal Incident state transition from "${fromStatus}" to "${toStatus}". Allowed: [${(VALID_TRANSITIONS[fromStatus] || []).join(', ')}]`
    );
  }
}
