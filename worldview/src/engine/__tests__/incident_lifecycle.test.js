import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIncident,
  transitionIncident,
  canTransition,
  validateTransition,
  IncidentManager,
  IncidentStatus,
  SeverityLevel,
  SourceMode,
} from '../index.js';

describe('Incident State Machine & Lifecycle', () => {
  test('validates permissible lifecycle transitions', () => {
    assert.equal(canTransition(IncidentStatus.DETECTED, IncidentStatus.ASSESSING), true);
    assert.equal(canTransition(IncidentStatus.ASSESSING, IncidentStatus.CONFIRMED), true);
    assert.equal(canTransition(IncidentStatus.CONFIRMED, IncidentStatus.ACTIVE), true);
    assert.equal(canTransition(IncidentStatus.ACTIVE, IncidentStatus.RESOLVED), true);
    assert.equal(canTransition(IncidentStatus.ASSESSING, IncidentStatus.DISMISSED), true);

    // Invalid transitions
    assert.equal(canTransition(IncidentStatus.RESOLVED, IncidentStatus.DETECTED), false);
    assert.equal(canTransition(IncidentStatus.DETECTED, IncidentStatus.CONFIRMED), false);

    // validateTransition does not throw for valid transitions
    assert.doesNotThrow(() => validateTransition(IncidentStatus.DETECTED, IncidentStatus.ASSESSING));
  });

  test('records transition history and timestamps on state progression', () => {
    let inc = createIncident({
      id: 'inc-test-01',
      title: 'Flash Flood Signal',
      type: 'FLOOD',
      status: IncidentStatus.DETECTED,
      severity: SeverityLevel.MODERATE,
      confidence: 0.6,
      sourceMode: SourceMode.LIVE,
    });

    assert.equal(inc.lifecycleHistory.length, 1);
    assert.equal(inc.lifecycleHistory[0].toStatus, IncidentStatus.DETECTED);

    // Transition DETECTED -> ASSESSING
    inc = transitionIncident(inc, IncidentStatus.ASSESSING, 'Correlated water level sensor');
    assert.equal(inc.status, IncidentStatus.ASSESSING);
    assert.equal(inc.lifecycleHistory.length, 2);
    assert.equal(inc.lifecycleHistory[1].fromStatus, IncidentStatus.DETECTED);
    assert.equal(inc.lifecycleHistory[1].toStatus, IncidentStatus.ASSESSING);

    // Transition ASSESSING -> CONFIRMED
    inc = transitionIncident(inc, IncidentStatus.CONFIRMED, 'Threshold exceeded on 3 stations');
    assert.equal(inc.status, IncidentStatus.CONFIRMED);
    assert.equal(inc.lifecycleHistory.length, 3);

    // Transition CONFIRMED -> ACTIVE
    inc = transitionIncident(inc, IncidentStatus.ACTIVE, 'Operational command tasked');
    assert.equal(inc.status, IncidentStatus.ACTIVE);

    // Transition ACTIVE -> RESOLVED
    inc = transitionIncident(inc, IncidentStatus.RESOLVED, 'Water levels normalized');
    assert.equal(inc.status, IncidentStatus.RESOLVED);
    assert.equal(inc.lifecycleHistory.length, 5);
  });

  test('throws error on illegal state transitions', () => {
    const inc = createIncident({
      id: 'inc-test-illegal',
      title: 'Test Incident',
      type: 'FLOOD',
      status: IncidentStatus.RESOLVED,
    });

    assert.throws(() => {
      transitionIncident(inc, IncidentStatus.DETECTED, 'Illegal jump back');
    }, /Illegal Incident state transition/);
  });

  test('IncidentManager manages active vs historical incidents and merges evidence', () => {
    const manager = new IncidentManager();

    const hyp1 = {
      id: 'inc-manager-01',
      hazardType: 'FLOOD',
      title: 'Urban Flood',
      status: IncidentStatus.DETECTED,
      confidence: 0.6,
      sourceMode: SourceMode.SIMULATED,
      evidence: [
        { eventId: 'ev-1', relevance: 'PRIMARY_HAZARD', confidence: 0.9 },
      ],
    };

    const inc1 = manager.ingestHypothesis(hyp1, { score: 70, severity: SeverityLevel.HIGH });
    assert.equal(manager.getActive().length, 1);
    assert.equal(inc1.evidence.length, 1);

    // Re-ingest with additional evidence
    const hyp2 = {
      id: 'inc-manager-01',
      hazardType: 'FLOOD',
      title: 'Urban Flood',
      status: IncidentStatus.ASSESSING,
      confidence: 0.85,
      sourceMode: SourceMode.SIMULATED,
      evidence: [
        { eventId: 'ev-1', relevance: 'PRIMARY_HAZARD', confidence: 0.9 }, // duplicate, will merge
        { eventId: 'ev-2', relevance: 'CORROBORATING_OBSERVATION', confidence: 0.88 }, // new
      ],
    };

    const incUpdated = manager.ingestHypothesis(hyp2, { score: 78, severity: SeverityLevel.HIGH });
    assert.equal(incUpdated.evidence.length, 2);
    assert.equal(incUpdated.status, IncidentStatus.ASSESSING);

    // Dismiss incident
    manager.dismiss('inc-manager-01', 'False alarm detected');
    assert.equal(manager.getActive().length, 0);
    assert.equal(manager.getAll().length, 1);
    assert.equal(manager.get('inc-manager-01').status, IncidentStatus.DISMISSED);
  });
});
