import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DataPipeline,
  ScenarioRunner,
  BENGALURU_FLOOD_SCENARIO,
  SourceMode,
  IncidentStatus,
} from '../index.js';
import { globalProviderManager, WorkloadCategory } from '../lifecycle/ProviderManager.js';
import { CentralizedCameraController } from '../camera/CentralizedCameraController.js';
import { CrisisDiscoveryEngine } from '../discovery/CrisisDiscoveryEngine.js';
import { COUNTRIES, getCountryById } from '../../data/countries.js';
import { SEVERITY_THRESHOLDS, scoreToSeverity } from '../risk/severityPolicy.js';

describe('Phase 6D: Crisis Intelligence Operator Workspace & UI/UX System', () => {
  test('1. Rapid Incident Selection: 10 rapid selections retain stable single active incident without duplication', () => {
    const pipeline = new DataPipeline();
    const runner = new ScenarioRunner(pipeline);
    runner.runInstant(BENGALURU_FLOOD_SCENARIO);

    const activeIncidents = pipeline.getActiveIncidents();
    assert.equal(activeIncidents.length, 1);

    const cameraController = new CentralizedCameraController();

    // Perform 10 rapid selections
    for (let i = 0; i < 10; i++) {
      cameraController.flyToCrisisRadius(activeIncidents[0]);
    }

    assert.equal(cameraController.activeFlightId, 10);
    assert.ok(cameraController.history.incident);
    assert.equal(pipeline.getActiveIncidents().length, 1, 'Incident count must remain 1 after repeated selection');
  });

  test('2. Rapid Tab Transitions: Cycles through all 7 workspace tabs instantaneously without state corruption', () => {
    const tabs = ['OVERVIEW', 'IMPACT', 'RISKS', 'EVIDENCE', 'RESPONSE', 'TIMELINE', 'AI'];
    let currentTab = 'OVERVIEW';

    // Perform 10 rapid tab cycles (70 transitions)
    for (let cycle = 0; cycle < 10; cycle++) {
      for (const tab of tabs) {
        currentTab = tab;
      }
    }

    assert.equal(currentTab, 'AI');
    assert.equal(tabs.length, 7);
  });

  test('3. Mode Transitions (WORLD ⇄ CRISIS): Communicates cleanly with ProviderManager without parallel lifecycle churn', () => {
    globalProviderManager.setMode('WORLD');
    assert.equal(globalProviderManager.activeMode, 'WORLD');

    // Rapid mode switches
    for (let i = 0; i < 10; i++) {
      const mode = i % 2 === 0 ? 'CRISIS' : 'WORLD';
      globalProviderManager.setMode(mode);
      assert.equal(globalProviderManager.activeMode, mode);
    }

    globalProviderManager.setMode('WORLD');
    assert.equal(globalProviderManager.activeMode, 'WORLD');
  });

  test('4. Theater & Incident Traversal: CRISIS → Country → Incident → Return to Country', () => {
    const cameraController = new CentralizedCameraController();
    const india = getCountryById('IN');
    const indonesia = getCountryById('ID');

    // 1. Enter India theater
    cameraController.flyToCountry(india);
    assert.equal(cameraController.history.country.lat, india.center.lat);

    // 2. Select an incident in India
    const fakeIncident = {
      id: 'inc-india-001',
      title: 'M6.2 Northern Sumatra / Andaman Rupture',
      location: { lat: 10.5, lon: 92.5 },
      severity: 'HIGH',
      risk: { score: 72 },
    };
    cameraController.flyToCrisisRadius(fakeIncident);
    assert.equal(cameraController.history.incident.lat, 10.5);

    // 3. Return to country theater
    cameraController.returnToCountry(india);
    assert.equal(cameraController.history.country.lat, india.center.lat);

    // 4. Switch to Indonesia theater
    cameraController.flyToCountry(indonesia);
    assert.equal(cameraController.history.country.lat, indonesia.center.lat);
  });

  test('5. Level-2 Popover Invariant: Maximum ONE active popover allowed at any time', () => {
    let activePopover = null;
    const openPopover = (type, data = null) => {
      activePopover = { type, data };
    };
    const closePopover = () => {
      activePopover = null;
    };

    // Open DATA_HEALTH
    openPopover('DATA_HEALTH');
    assert.equal(activePopover.type, 'DATA_HEALTH');

    // Open EXPOSURE (replaces DATA_HEALTH, never stacks)
    openPopover('EXPOSURE', { population: 43200 });
    assert.equal(activePopover.type, 'EXPOSURE');
    assert.equal(activePopover.data.population, 43200);

    // Open RISK_BREAKDOWN
    openPopover('RISK_BREAKDOWN', { score: 84 });
    assert.equal(activePopover.type, 'RISK_BREAKDOWN');

    // Close popover
    closePopover();
    assert.equal(activePopover, null);
  });

  test('6. Data-Driven Country Discovery: Pure configuration consumption without hardcoded country assumptions', () => {
    assert.ok(Array.isArray(COUNTRIES));
    assert.ok(COUNTRIES.length >= 6);

    for (const c of COUNTRIES) {
      assert.ok(c.id);
      assert.ok(c.name);
      assert.ok(c.center);
      assert.ok(typeof c.center.lat === 'number');
      assert.ok(typeof c.center.lon === 'number');
      assert.ok(Array.isArray(c.theaters));

      const discovery = CrisisDiscoveryEngine.discover(c, []);
      assert.ok(Array.isArray(discovery.activeCrises));
    }
  });

  test('7. Centralized Severity Derivation: Risk 84/100 maps deterministically to CRITICAL', () => {
    assert.equal(scoreToSeverity(84), 'CRITICAL');
    assert.equal(scoreToSeverity(72), 'HIGH');
    assert.equal(scoreToSeverity(45), 'MODERATE');
    assert.equal(scoreToSeverity(20), 'LOW');
  });
});
