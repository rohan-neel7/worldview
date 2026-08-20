import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DataPipeline,
  ScenarioRunner,
  BENGALURU_FLOOD_SCENARIO,
  SourceMode,
  IncidentStatus,
} from '../index.js';

describe('Simulation Pipeline & Bengaluru Flood Scenario', () => {
  test('executes end-to-end simulated flood scenario through the unified pipeline', () => {
    const pipeline = new DataPipeline();
    const runner = new ScenarioRunner(pipeline);

    // Run Bengaluru flood scenario
    const incidents = runner.runInstant(BENGALURU_FLOOD_SCENARIO);

    assert.ok(incidents.length > 0, 'Scenario should generate at least one incident');

    const floodInc = incidents.find((inc) => inc.type === 'FLOOD');
    assert.ok(floodInc, 'Should contain a FLOOD incident');

    // 1. SourceMode must be SIMULATED
    assert.equal(floodInc.sourceMode, SourceMode.SIMULATED);

    // 2. Incident must contain traceable evidence
    assert.ok(floodInc.evidence.length >= 2, `Expected multi-frame evidence, got ${floodInc.evidence.length}`);
    for (const evItem of floodInc.evidence) {
      assert.equal(evItem.sourceMode, SourceMode.SIMULATED);
      assert.ok(evItem.eventId);
      assert.ok(evItem.relationship);
    }

    // 3. Status must have progressed based on multi-frame evidence
    assert.ok(
      [IncidentStatus.ASSESSING, IncidentStatus.CONFIRMED, IncidentStatus.ACTIVE].includes(floodInc.status),
      `Expected active lifecycle status, got ${floodInc.status}`
    );

    // 4. Deterministic Risk Assessment attached
    assert.ok(floodInc.risk);
    assert.ok(floodInc.risk.score >= 60, `Expected elevated risk score, got ${floodInc.risk.score}`);
    assert.ok(Array.isArray(floodInc.risk.breakdown));
    assert.ok(floodInc.risk.explanation);

    // 5. Pipeline metrics accurately distinguish simulated from live
    const metrics = pipeline.getPipelineMetrics();
    assert.equal(metrics.simulatedCount, 3);
    assert.equal(metrics.liveCount, 0);
    assert.equal(metrics.activeIncidents, 1);
  });

  test('simulates step-by-step frame progression', () => {
    const pipeline = new DataPipeline();
    const runner = new ScenarioRunner(pipeline);

    // Dispatch Frame 0 (Rainfall Anomaly only -> ASSESSING)
    runner.dispatchFrame(0, BENGALURU_FLOOD_SCENARIO);
    let active = pipeline.getActiveIncidents();
    assert.equal(active.length, 1);
    assert.equal(active[0].status, IncidentStatus.ASSESSING);
    assert.ok(active[0].evidence.length >= 1);

    // Dispatch Frame 1 (Catchment Gauge surge -> CONFIRMED)
    runner.dispatchFrame(1, BENGALURU_FLOOD_SCENARIO);
    active = pipeline.getActiveIncidents();
    assert.equal(active.length, 1);
    assert.equal(active[0].status, IncidentStatus.CONFIRMED);
    assert.ok(active[0].evidence.length >= 2);
  });
});
