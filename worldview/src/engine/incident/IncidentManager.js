import { IncidentStatus, SeverityLevel } from '../event/types.js';
import { createIncident, transitionIncident } from './IncidentModel.js';

export class IncidentManager {
  constructor() {
    this.incidents = new Map();
  }

  /**
   * Ingests a hypothesis produced by the Fusion Engine and attaches its risk assessment.
   *
   * @param {object} hypothesis
   * @param {object} [riskAssessment=null]
   * @returns {object} Updated or created incident
   */
  ingestHypothesis(hypothesis, riskAssessment = null) {
    if (!hypothesis || !hypothesis.id) return null;

    const existing = this.incidents.get(hypothesis.id);

    if (existing) {
      // Merge new evidence
      const existingEventIds = new Set(existing.evidence.map((e) => e.eventId));
      const newEvidence = [...existing.evidence];

      if (Array.isArray(hypothesis.evidence)) {
        for (const item of hypothesis.evidence) {
          if (!existingEventIds.has(item.eventId)) {
            newEvidence.push(item);
            existingEventIds.add(item.eventId);
          }
        }
      }

      // Determine severity from risk score if provided
      let severity = existing.severity;
      if (riskAssessment?.severity) {
        severity = riskAssessment.severity;
      }

      let updated = {
        ...existing,
        confidence: Math.max(existing.confidence, hypothesis.confidence || 0.5),
        severity,
        evidence: newEvidence,
        evidenceGaps: hypothesis.evidenceGaps || existing.evidenceGaps,
        risk: riskAssessment || existing.risk,
        impactData: hypothesis.impactData || existing.impactData || null,
        updatedAt: new Date().toISOString(),
      };

      // Progress lifecycle if target status in hypothesis is higher and valid
      if (hypothesis.status && hypothesis.status !== existing.status) {
        try {
          updated = transitionIncident(
            updated,
            hypothesis.status,
            `Correlated additional sensor telemetry (${newEvidence.length} evidence items attached)`
          );
        } catch (_err) {
          // Transition not permitted, retain current state
        }
      }

      this.incidents.set(updated.id, updated);
      return updated;
    }

    // Determine initial severity
    let initialSeverity = SeverityLevel.MODERATE;
    if (riskAssessment?.severity) {
      initialSeverity = riskAssessment.severity;
    }

    // Create new incident
    const newInc = createIncident({
      id: hypothesis.id,
      title: hypothesis.title,
      type: hypothesis.hazardType,
      status: hypothesis.status || IncidentStatus.DETECTED,
      severity: initialSeverity,
      confidence: hypothesis.confidence || 0.5,
      sourceMode: hypothesis.sourceMode,
      location: hypothesis.location,
      geometry: hypothesis.geometry,
      evidence: hypothesis.evidence || [],
      evidenceGaps: hypothesis.evidenceGaps || [],
      risk: riskAssessment,
      impactData: hypothesis.impactData || null,
    });

    this.incidents.set(newInc.id, newInc);
    return newInc;
  }

  /**
   * Manually transitions an incident to a new state.
   */
  transition(id, toStatus, reason) {
    const inc = this.incidents.get(id);
    if (!inc) throw new Error(`Incident "${id}" not found`);
    const updated = transitionIncident(inc, toStatus, reason);
    this.incidents.set(id, updated);
    return updated;
  }

  resolve(id, reason = 'Threat subsided / nominal sensor telemetry restored') {
    return this.transition(id, IncidentStatus.RESOLVED, reason);
  }

  dismiss(id, reason = 'Insufficient empirical evidence / false positive hypothesis') {
    return this.transition(id, IncidentStatus.DISMISSED, reason);
  }

  get(id) {
    return this.incidents.get(id) || null;
  }

  getAll() {
    return Array.from(this.incidents.values());
  }

  getActive() {
    return Array.from(this.incidents.values()).filter(
      (inc) =>
        inc.status === IncidentStatus.DETECTED ||
        inc.status === IncidentStatus.ASSESSING ||
        inc.status === IncidentStatus.CONFIRMED ||
        inc.status === IncidentStatus.ACTIVE
    );
  }

  clear() {
    this.incidents.clear();
  }
}

export const defaultIncidentManager = new IncidentManager();
