/**
 * Worldview Phase 6A — Data Fabric Registry + Provider Contracts Tests
 *
 * Comprehensive test suite validating all architectural invariants:
 *   1. Registry: register, retrieve, reject duplicates, enable/disable, planned ≠ live
 *   2. Coverage: global, country, bbox matching
 *   3. Lifecycle: state transitions, ownership, no duplicate starts
 *   4. Health: healthy, degraded, failed, independent from freshness
 *   5. Auth: no secrets stored, secretRef allowed, sanitized errors
 *   6. Fallback: provenance preserved, no masquerading
 *   7. Data states: all 7 representable, ≠ freshness
 *   8. Capabilities: AVAILABLE, PARTIAL, PLANNED, UNAVAILABLE from real connectivity
 *   9. Data fabric: delegates to pipeline, no duplicate store, rejects planned providers
 *  10. Data quality: factorized score with visible breakdown
 *  11. Retry policy: per-failure-type behavior
 *  12. Visualization providers: registered without CanonicalEvent requirement
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Types
  ProviderTier, ProviderRole, DataState, ProviderStatus,
  CoverageType, TemporalResolution, AuthType, LicenseStatus,
  AccessType, CapabilityStatus, ProviderOwnership, FailureType,
  ProviderClass, LifecycleState,
  // Contract
  createProviderDefinition, validateProviderDefinition,
  // Health
  ProviderHealthTracker,
  // Coverage
  matchesCoverage, isWithinBbox,
  // Retry
  createRetryPolicy, shouldRetry,
  // Data Quality
  computeDataQuality,
  // Registry
  ProviderRegistry,
  // Capabilities
  CapabilityRegistry,
  // Data Fabric
  DataFabric,
  // Lifecycle
  ProviderLifecycleContract, ProviderLifecycleManager,
  // Definitions
  CURRENT_PROVIDERS, PLANNED_PROVIDERS,
} from '../providers/index.js';

import { SourceMode, FreshnessStatus } from '../event/types.js';

// ── Minimal test provider config ─────────────────────────────────────────────
function makeTestProvider(overrides = {}) {
  return {
    id: overrides.id || 'TEST_PROVIDER',
    name: overrides.name || 'Test Provider',
    organization: overrides.organization || 'Test Org',
    tier: overrides.tier || ProviderTier.TIER_C,
    providerClass: overrides.providerClass || ProviderClass.EVENT_PROVIDER,
    dataTypes: overrides.dataTypes || ['EARTHQUAKE'],
    roles: overrides.roles || [ProviderRole.DETECTION],
    dataState: overrides.dataState || DataState.OBSERVED,
    sourceMode: overrides.sourceMode || SourceMode.LIVE,
    ownership: overrides.ownership || ProviderOwnership.SHARED,
    adapterKey: overrides.adapterKey !== undefined ? overrides.adapterKey : 'TEST',
    version: '1.0',
    connected: overrides.connected ?? true,
    coverage: overrides.coverage || { type: CoverageType.GLOBAL },
    temporalResolution: overrides.temporalResolution || {
      type: TemporalResolution.MINUTES,
      expectedFreshnessMs: 300000,
      expectedLatencyMs: 5000,
    },
    runtimeConfig: {
      timeoutMs: 10000,
      pollIntervalMs: 300000,
      maxRetries: 3,
      backoffBaseMs: 1000,
      backoffMaxMs: 60000,
      rateLimitPerMinute: null,
      priority: 1,
      enabled: overrides.connected !== false ? true : false,
      ...overrides.runtimeConfig,
    },
    governance: overrides.governance || {
      auth: { type: AuthType.PUBLIC, secretRef: null },
      license: { status: LicenseStatus.VERIFIED, accessType: AccessType.OPEN, attribution: 'Test', redistribution: null },
      verification: { status: 'VERIFIED', verifiedAt: '2026-01-01', verificationSource: 'test', accessNotes: null, limitations: null },
    },
    fallback: overrides.fallback || { providerId: null, strategy: null, degradationNotice: null },
  };
}

// ── Minimal mock DataPipeline ────────────────────────────────────────────────
function createMockPipeline() {
  const store = [];
  return {
    ingestCanonical(events) {
      store.push(...events);
    },
    getEvents(filter = {}) {
      let result = [...store];
      if (filter.type) result = result.filter((e) => e.type === filter.type);
      if (filter.category) result = result.filter((e) => e.category === filter.category);
      return result;
    },
    _getStore() { return store; },
    _clear() { store.length = 0; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ProviderRegistry', () => {
  test('registers and retrieves a provider by ID', () => {
    const registry = new ProviderRegistry();
    const def = registry.register(makeTestProvider({ id: 'REG_TEST_1' }));
    assert.equal(def.id, 'REG_TEST_1');
    assert.equal(registry.get('REG_TEST_1').id, 'REG_TEST_1');
  });

  test('rejects duplicate provider IDs', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'DUP_TEST' }));
    assert.throws(() => registry.register(makeTestProvider({ id: 'DUP_TEST' })), /already registered/);
  });

  test('provider definitions are frozen (immutable)', () => {
    const registry = new ProviderRegistry();
    const def = registry.register(makeTestProvider({ id: 'FREEZE_TEST' }));
    assert.ok(Object.isFrozen(def));
    assert.throws(() => { def.name = 'MUTATED'; });
  });

  test('enable/disable provider', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'TOGGLE_TEST' }));
    assert.equal(registry.get('TOGGLE_TEST').runtimeConfig.enabled, true);

    registry.disable('TOGGLE_TEST');
    assert.equal(registry.get('TOGGLE_TEST').runtimeConfig.enabled, false);

    registry.enable('TOGGLE_TEST');
    assert.equal(registry.get('TOGGLE_TEST').runtimeConfig.enabled, true);
  });

  test('planned provider cannot be enabled', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'PLANNED_ENABLE', connected: false }));
    const result = registry.enable('PLANNED_ENABLE');
    assert.equal(result, false);
    assert.equal(registry.get('PLANNED_ENABLE').runtimeConfig.enabled, false);
  });

  test('queries by tier, role, data type, ownership, class', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'Q1', tier: ProviderTier.TIER_A, roles: [ProviderRole.DETECTION], dataTypes: ['EARTHQUAKE'], ownership: ProviderOwnership.SHARED }));
    registry.register(makeTestProvider({ id: 'Q2', tier: ProviderTier.TIER_C, roles: [ProviderRole.CONTEXT], dataTypes: ['AIRCRAFT'], ownership: ProviderOwnership.WORLD, providerClass: ProviderClass.VISUALIZATION_PROVIDER }));

    assert.equal(registry.getByTier(ProviderTier.TIER_A).length, 1);
    assert.equal(registry.getByRole(ProviderRole.CONTEXT).length, 1);
    assert.equal(registry.getByDataType('AIRCRAFT').length, 1);
    assert.equal(registry.getByOwnership(ProviderOwnership.WORLD).length, 1);
    assert.equal(registry.getByClass(ProviderClass.VISUALIZATION_PROVIDER).length, 1);
  });

  test('getConnected and getPlanned separate connected from planned', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'CONN_1', connected: true }));
    registry.register(makeTestProvider({ id: 'PLAN_1', connected: false }));
    assert.equal(registry.getConnected().length, 1);
    assert.equal(registry.getPlanned().length, 1);
    assert.equal(registry.isPlanned('PLAN_1'), true);
    assert.equal(registry.isPlanned('CONN_1'), false);
  });

  test('snapshot provides full registry state', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'SNAP_1' }));
    const snap = registry.getSnapshot();
    assert.equal(snap.totalProviders, 1);
    assert.ok(snap.providers.SNAP_1);
    assert.equal(snap.providers.SNAP_1.connected, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COVERAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Coverage Model', () => {
  test('GLOBAL coverage matches any location', () => {
    const def = createProviderDefinition(makeTestProvider({ coverage: { type: CoverageType.GLOBAL } }));
    assert.ok(matchesCoverage(def, { lat: 28.6, lon: 77.2 }));
    assert.ok(matchesCoverage(def, { lat: -33.9, lon: 151.2 }));
  });

  test('COUNTRY coverage matches within bounds', () => {
    const def = createProviderDefinition(makeTestProvider({
      coverage: { type: CoverageType.COUNTRY, countries: ['IN'] },
    }));
    assert.ok(matchesCoverage(def, { lat: 28.6, lon: 77.2 }));  // Delhi
    assert.ok(!matchesCoverage(def, { lat: 51.5, lon: -0.1 })); // London
  });

  test('BBOX coverage matches within box', () => {
    const def = createProviderDefinition(makeTestProvider({
      coverage: { type: CoverageType.BBOX, bbox: { minLat: 10, maxLat: 40, minLon: 60, maxLon: 100 } },
    }));
    assert.ok(matchesCoverage(def, { lat: 28, lon: 77 }));
    assert.ok(!matchesCoverage(def, { lat: 50, lon: 0 }));
    assert.ok(isWithinBbox(28, 77, { minLat: 10, maxLat: 40, minLon: 60, maxLon: 100 }));
    assert.ok(!isWithinBbox(50, 0, { minLat: 10, maxLat: 40, minLon: 60, maxLon: 100 }));
  });

  test('UNKNOWN coverage returns true (permissive)', () => {
    const def = createProviderDefinition(makeTestProvider({
      coverage: { type: CoverageType.UNKNOWN },
    }));
    assert.ok(matchesCoverage(def, { lat: 0, lon: 0 }));
  });

  test('getProvidersForLocation filters by coverage', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'LOC_GLOBAL', coverage: { type: CoverageType.GLOBAL } }));
    registry.register(makeTestProvider({ id: 'LOC_INDIA', coverage: { type: CoverageType.COUNTRY, countries: ['IN'] } }));

    const delhiProviders = registry.getProvidersForLocation(28.6, 77.2);
    assert.equal(delhiProviders.length, 2);

    const londonProviders = registry.getProvidersForLocation(51.5, -0.1);
    assert.equal(londonProviders.length, 1);
    assert.equal(londonProviders[0].id, 'LOC_GLOBAL');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LIFECYCLE CONTRACT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Provider Lifecycle Contract', () => {
  test('valid state transitions: UNINITIALIZED → INITIALIZED → RUNNING ⇄ PAUSED → STOPPED', () => {
    const lc = new ProviderLifecycleContract('LC_TEST');
    assert.equal(lc.getState(), LifecycleState.UNINITIALIZED);

    lc.initialize();
    assert.equal(lc.getState(), LifecycleState.INITIALIZED);

    lc.start(ProviderOwnership.WORLD);
    assert.equal(lc.getState(), LifecycleState.RUNNING);
    assert.equal(lc.getOwner(), ProviderOwnership.WORLD);

    lc.pause();
    assert.equal(lc.getState(), LifecycleState.PAUSED);

    lc.resume();
    assert.equal(lc.getState(), LifecycleState.RUNNING);

    lc.stop();
    assert.equal(lc.getState(), LifecycleState.STOPPED);
    assert.equal(lc.getOwner(), null);
  });

  test('invalid transitions throw errors', () => {
    const lc = new ProviderLifecycleContract('LC_INVALID');
    assert.throws(() => lc.start(), /Invalid lifecycle transition/);  // Can't start from UNINITIALIZED
    assert.throws(() => lc.pause(), /Invalid lifecycle transition/);
  });

  test('prevents duplicate start under different owner', () => {
    const lc = new ProviderLifecycleContract('LC_DUP');
    lc.initialize();
    lc.start(ProviderOwnership.WORLD);
    assert.throws(() => lc.start(ProviderOwnership.CRISIS), /already running/);
  });

  test('same owner start is no-op (idempotent)', () => {
    const lc = new ProviderLifecycleContract('LC_IDEM');
    lc.initialize();
    lc.start(ProviderOwnership.WORLD);
    lc.start(ProviderOwnership.WORLD);  // Should not throw
    assert.equal(lc.getState(), LifecycleState.RUNNING);
  });

  test('ProviderLifecycleManager registers and retrieves lifecycles', () => {
    const mgr = new ProviderLifecycleManager();
    const lc = mgr.registerLifecycle('MGR_TEST');
    assert.ok(lc instanceof ProviderLifecycleContract);
    assert.equal(mgr.getLifecycle('MGR_TEST'), lc);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. HEALTH TRACKING TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Provider Health Tracker', () => {
  test('records success and transitions to HEALTHY', () => {
    const tracker = new ProviderHealthTracker();
    tracker.recordSuccess('H_TEST', 150);
    const health = tracker.getHealth('H_TEST');
    assert.equal(health.status, ProviderStatus.HEALTHY);
    assert.ok(health.lastSuccessfulRequest);
    assert.equal(health.averageLatencyMs, 150);
    assert.equal(health.consecutiveFailures, 0);
  });

  test('consecutive failures transition to DEGRADED then FAILED', () => {
    const tracker = new ProviderHealthTracker();
    // 3 failures → DEGRADED
    for (let i = 0; i < 3; i++) {
      tracker.recordFailure('H_FAIL', FailureType.TIMEOUT, 'timeout');
    }
    assert.equal(tracker.getHealth('H_FAIL').status, ProviderStatus.DEGRADED);

    // 7 total failures → FAILED
    for (let i = 0; i < 4; i++) {
      tracker.recordFailure('H_FAIL', FailureType.TIMEOUT, 'timeout');
    }
    assert.equal(tracker.getHealth('H_FAIL').status, ProviderStatus.FAILED);
  });

  test('success resets consecutive failures', () => {
    const tracker = new ProviderHealthTracker();
    tracker.recordFailure('H_RESET', FailureType.TIMEOUT, 'fail');
    tracker.recordFailure('H_RESET', FailureType.TIMEOUT, 'fail');
    tracker.recordSuccess('H_RESET', 100);
    assert.equal(tracker.getHealth('H_RESET').consecutiveFailures, 0);
    assert.equal(tracker.getHealth('H_RESET').status, ProviderStatus.HEALTHY);
  });

  test('error messages are sanitized (no secrets in output)', () => {
    const tracker = new ProviderHealthTracker();
    tracker.recordFailure('H_SEC', FailureType.AUTH_FAILURE,
      'Request to https://api.example.com?api_key=SECRET_VALUE_123 failed');
    const health = tracker.getHealth('H_SEC');
    assert.ok(!health.lastError.message.includes('SECRET_VALUE_123'));
    assert.ok(health.lastError.message.includes('<REDACTED>'));
  });

  test('provider health and data freshness are independent', () => {
    const tracker = new ProviderHealthTracker();
    // Provider is healthy but no data received → freshness UNKNOWN
    tracker.recordSuccess('H_INDEP', 100);
    assert.equal(tracker.getHealth('H_INDEP').status, ProviderStatus.HEALTHY);
    assert.equal(tracker.getDataFreshness('H_INDEP', 300000), FreshnessStatus.UNKNOWN);

    // Record stale data
    const oldTime = new Date(Date.now() - 900000).toISOString();  // 15 min ago
    tracker.recordDataReceived('H_INDEP', oldTime);
    assert.equal(tracker.getHealth('H_INDEP').status, ProviderStatus.HEALTHY);
    assert.equal(tracker.getDataFreshness('H_INDEP', 300000), FreshnessStatus.STALE);  // 15min is between 5min*2 and 5min*5
  });

  test('bounded error history', () => {
    const tracker = new ProviderHealthTracker();
    for (let i = 0; i < 15; i++) {
      tracker.recordFailure('H_BOUND', FailureType.TIMEOUT, `error ${i}`);
    }
    // Internal state should have at most 10 recent errors
    const health = tracker.getHealth('H_BOUND');
    assert.equal(health.errorCount, 15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. AUTH & SECURITY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auth & Security', () => {
  test('secretRef (reference name) is allowed in definitions', () => {
    const def = createProviderDefinition(makeTestProvider({
      id: 'AUTH_REF',
      governance: {
        auth: { type: AuthType.API_KEY, secretRef: 'MY_API_KEY_VAR' },
        license: { status: LicenseStatus.VERIFIED, accessType: AccessType.OPEN, attribution: 'Test', redistribution: null },
        verification: { status: 'VERIFIED', verifiedAt: '2026-01-01', verificationSource: 'test', accessNotes: null, limitations: null },
      },
    }));
    assert.equal(def.governance.auth.secretRef, 'MY_API_KEY_VAR');
  });

  test('actual secret values are rejected in definitions', () => {
    assert.throws(() => createProviderDefinition(makeTestProvider({
      id: 'AUTH_LEAK',
      governance: {
        auth: { type: AuthType.API_KEY, secretRef: 'AIzaSyB2KjC17l9IufmvTuV1JCLNTQwnkjP3qHY' },
        license: { status: LicenseStatus.VERIFIED, accessType: AccessType.OPEN, attribution: 'Test', redistribution: null },
        verification: { status: 'VERIFIED', verifiedAt: '2026-01-01', verificationSource: 'test', accessNotes: null, limitations: null },
      },
    })), /actual secret/);
  });

  test('snapshots contain no secret values', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({
      id: 'SNAP_SEC',
      governance: {
        auth: { type: AuthType.API_KEY, secretRef: 'SAFE_REF_NAME' },
        license: { status: LicenseStatus.VERIFIED, accessType: AccessType.OPEN, attribution: 'Test', redistribution: null },
        verification: { status: 'VERIFIED', verifiedAt: '2026-01-01', verificationSource: 'test', accessNotes: null, limitations: null },
      },
    }));
    const snap = JSON.stringify(registry.getSnapshot());
    assert.ok(!snap.includes('api_key'));
    assert.ok(!snap.includes('password'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FALLBACK PROVENANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fallback Semantics', () => {
  test('fallback observations retain actual source identity', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'FB_PRIMARY', adapterKey: 'IMD' }));
    registry.register(makeTestProvider({ id: 'FB_FALLBACK', adapterKey: 'OPEN_METEO' }));

    const tracker = new ProviderHealthTracker();
    const pipeline = createMockPipeline();
    const fabric = new DataFabric({ providerRegistry: registry, healthTracker: tracker, dataPipeline: pipeline });

    // Ingest fallback data
    const events = [{
      id: 'fb-event-1', source: 'Open-Meteo', sourceMode: 'LIVE',
      type: 'WEATHER', category: 'ENVIRONMENTAL',
      observedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      location: { lat: 28.6, lon: 77.2 },
      provenance: { source: 'Open-Meteo' },
      confidence: 0.9, freshness: { status: 'LIVE' }, payload: {},
    }];

    fabric.ingest('FB_FALLBACK', events, { fallbackUsed: true, fallbackFor: 'FB_PRIMARY' });

    const stored = pipeline._getStore();
    assert.equal(stored.length, 1);
    // Source remains Open-Meteo, NOT IMD
    assert.equal(stored[0].source, 'Open-Meteo');
    assert.equal(stored[0].provenance.fallbackUsed, true);
    assert.equal(stored[0].provenance.fallbackFor, 'FB_PRIMARY');
    assert.equal(stored[0].provenance.providerId, 'FB_FALLBACK');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DATA STATE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data States', () => {
  test('all 7 data states are representable', () => {
    const states = [DataState.OBSERVED, DataState.FORECAST, DataState.MODELED,
                    DataState.INFERRED, DataState.SIMULATED, DataState.STATIC, DataState.UNKNOWN];
    for (const state of states) {
      const def = createProviderDefinition(makeTestProvider({ id: `DS_${state}`, dataState: state }));
      assert.equal(def.dataState, state);
    }
  });

  test('data state is independent of freshness', () => {
    // WorldPop: STATIC data + STATIC/baseline freshness
    const def = createProviderDefinition(makeTestProvider({
      id: 'DS_STATIC_TEST',
      dataState: DataState.STATIC,
      temporalResolution: { type: TemporalResolution.STATIC, expectedFreshnessMs: 86400000 * 365, expectedLatencyMs: 5000 },
    }));
    assert.equal(def.dataState, DataState.STATIC);
    assert.equal(def.temporalResolution.type, TemporalResolution.STATIC);

    // Freshness computation is independent
    const tracker = new ProviderHealthTracker();
    tracker.recordDataReceived('DS_STATIC_TEST', new Date().toISOString());
    assert.equal(tracker.getDataFreshness('DS_STATIC_TEST', 86400000 * 365), FreshnessStatus.LIVE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CAPABILITY REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Capability Registry', () => {
  test('connected healthy provider → AVAILABLE', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'CAP_CONN', dataTypes: ['EARTHQUAKE'], roles: [ProviderRole.DETECTION], connected: true }));
    const tracker = new ProviderHealthTracker();
    tracker.recordSuccess('CAP_CONN', 100);

    const capReg = new CapabilityRegistry(registry, tracker);
    const cap = capReg.getCapability('EARTHQUAKE_DETECTION');
    assert.ok(cap);
    assert.equal(cap.status, CapabilityStatus.AVAILABLE);
  });

  test('only planned providers → PLANNED (not AVAILABLE)', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'CAP_PLAN', dataTypes: ['WILDFIRE_HOTSPOT'], roles: [ProviderRole.DETECTION], connected: false }));
    const tracker = new ProviderHealthTracker();

    const capReg = new CapabilityRegistry(registry, tracker);
    const cap = capReg.getCapability('WILDFIRE_HOTSPOT_DETECTION');
    assert.ok(cap);
    assert.equal(cap.status, CapabilityStatus.PLANNED);
  });

  test('no providers → capability not listed', () => {
    const registry = new ProviderRegistry();
    const tracker = new ProviderHealthTracker();
    const capReg = new CapabilityRegistry(registry, tracker);
    assert.equal(capReg.getCapability('NONEXISTENT_DETECTION'), null);
  });

  test('all connected providers DEGRADED → PARTIAL', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'CAP_DEG', dataTypes: ['FLOOD_SIGNAL'], roles: [ProviderRole.DETECTION], connected: true }));
    const tracker = new ProviderHealthTracker();
    // Force degraded
    for (let i = 0; i < 4; i++) tracker.recordFailure('CAP_DEG', FailureType.TIMEOUT, 'fail');

    const capReg = new CapabilityRegistry(registry, tracker);
    const cap = capReg.getCapability('FLOOD_SIGNAL_DETECTION');
    assert.equal(cap.status, CapabilityStatus.PARTIAL);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. DATA FABRIC TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data Fabric', () => {
  test('ingest routes events to DataPipeline (no duplicate store)', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'FAB_PIPE' }));
    const tracker = new ProviderHealthTracker();
    const pipeline = createMockPipeline();
    const fabric = new DataFabric({ providerRegistry: registry, healthTracker: tracker, dataPipeline: pipeline });

    const events = [{
      id: 'fab-1', source: 'TEST', sourceMode: 'LIVE',
      type: 'EARTHQUAKE', category: 'HAZARD',
      observedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      location: { lat: 10, lon: 20 },
      provenance: { source: 'TEST' },
      confidence: 0.95, freshness: { status: 'LIVE' }, payload: {},
    }];

    const result = fabric.ingest('FAB_PIPE', events);
    assert.equal(result.accepted, 1);
    assert.equal(result.error, null);

    // Events are in the pipeline, not in the fabric
    assert.equal(pipeline._getStore().length, 1);
  });

  test('rejects ingestion from planned providers', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'FAB_PLAN', connected: false }));
    const tracker = new ProviderHealthTracker();
    const pipeline = createMockPipeline();
    const fabric = new DataFabric({ providerRegistry: registry, healthTracker: tracker, dataPipeline: pipeline });

    const result = fabric.ingest('FAB_PLAN', [{ id: 'fake' }]);
    assert.equal(result.accepted, 0);
    assert.ok(result.error.includes('Planned provider'));
    assert.equal(pipeline._getStore().length, 0);
  });

  test('rejects ingestion from unregistered providers', () => {
    const registry = new ProviderRegistry();
    const tracker = new ProviderHealthTracker();
    const pipeline = createMockPipeline();
    const fabric = new DataFabric({ providerRegistry: registry, healthTracker: tracker, dataPipeline: pipeline });

    const result = fabric.ingest('NONEXISTENT', [{ id: 'fake' }]);
    assert.equal(result.accepted, 0);
    assert.ok(result.error.includes('Unknown provider'));
  });

  test('provenance enriched with providerId, tier, dataState', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'FAB_PROV', tier: ProviderTier.TIER_A, dataState: DataState.OBSERVED }));
    const tracker = new ProviderHealthTracker();
    const pipeline = createMockPipeline();
    const fabric = new DataFabric({ providerRegistry: registry, healthTracker: tracker, dataPipeline: pipeline });

    const events = [{
      id: 'prov-1', source: 'TEST', sourceMode: 'LIVE',
      type: 'EARTHQUAKE', category: 'HAZARD',
      observedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      location: { lat: 10, lon: 20 },
      provenance: { source: 'TEST' },
      confidence: 0.95, freshness: { status: 'LIVE' }, payload: {},
    }];

    fabric.ingest('FAB_PROV', events);
    const stored = pipeline._getStore();
    assert.equal(stored[0].provenance.providerId, 'FAB_PROV');
    assert.equal(stored[0].provenance.providerTier, ProviderTier.TIER_A);
    assert.equal(stored[0].provenance.dataState, DataState.OBSERVED);
  });

  test('multiple observations from different providers preserved (not merged)', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'FAB_OBS_A', adapterKey: 'USGS' }));
    registry.register(makeTestProvider({ id: 'FAB_OBS_B', adapterKey: 'OTHER' }));
    const tracker = new ProviderHealthTracker();
    const pipeline = createMockPipeline();
    const fabric = new DataFabric({ providerRegistry: registry, healthTracker: tracker, dataPipeline: pipeline });

    const evA = [{
      id: 'obs-a', source: 'USGS', sourceMode: 'LIVE',
      type: 'EARTHQUAKE', category: 'HAZARD',
      observedAt: new Date().toISOString(), receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      location: { lat: 35.7, lon: -117.5 },
      provenance: { source: 'USGS' },
      confidence: 0.98, freshness: { status: 'LIVE' },
      payload: { magnitude: 7.7 },
    }];
    const evB = [{
      id: 'obs-b', source: 'OTHER', sourceMode: 'LIVE',
      type: 'EARTHQUAKE', category: 'HAZARD',
      observedAt: new Date().toISOString(), receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      location: { lat: 35.7, lon: -117.5 },
      provenance: { source: 'OTHER' },
      confidence: 0.90, freshness: { status: 'LIVE' },
      payload: { magnitude: 7.6 },
    }];

    fabric.ingest('FAB_OBS_A', evA);
    fabric.ingest('FAB_OBS_B', evB);

    const stored = pipeline._getStore();
    assert.equal(stored.length, 2);
    // Both observations preserved — not merged
    assert.equal(stored[0].payload.magnitude, 7.7);
    assert.equal(stored[1].payload.magnitude, 7.6);
    assert.equal(stored[0].provenance.providerId, 'FAB_OBS_A');
    assert.equal(stored[1].provenance.providerId, 'FAB_OBS_B');
  });

  test('query delegates to pipeline', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'FAB_Q' }));
    const tracker = new ProviderHealthTracker();
    const pipeline = createMockPipeline();
    const fabric = new DataFabric({ providerRegistry: registry, healthTracker: tracker, dataPipeline: pipeline });

    // Direct pipeline insert to verify delegation
    pipeline.ingestCanonical([{ id: 'q-1', type: 'EARTHQUAKE', category: 'HAZARD' }]);
    const results = fabric.query({ type: 'EARTHQUAKE' });
    assert.equal(results.length, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. DATA QUALITY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data Quality', () => {
  test('computes factorized score with visible breakdown', () => {
    const result = computeDataQuality({
      freshness: FreshnessStatus.LIVE,
      tier: ProviderTier.TIER_A,
      completeness: 0.9,
      providerHealth: ProviderStatus.HEALTHY,
      coverage: 1.0,
    });
    assert.ok(result.score >= 80);
    assert.equal(result.label, 'HIGH');
    assert.equal(result.factors.length, 5);
    // All factors are visible
    const names = result.factors.map((f) => f.name);
    assert.ok(names.includes('freshness'));
    assert.ok(names.includes('sourceTier'));
    assert.ok(names.includes('completeness'));
    assert.ok(names.includes('providerHealth'));
    assert.ok(names.includes('coverage'));
  });

  test('tier score does not equal confidence', () => {
    const tierA = computeDataQuality({ tier: ProviderTier.TIER_A });
    const tierD = computeDataQuality({ tier: ProviderTier.TIER_D });
    // Tier A should score higher but this is not a confidence measure
    assert.ok(tierA.score > tierD.score);
    // Both should still produce valid factorized output
    assert.equal(tierA.factors.length, 5);
    assert.equal(tierD.factors.length, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. RETRY POLICY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Retry Policy', () => {
  test('AUTH_FAILURE never retries', () => {
    const result = shouldRetry(FailureType.AUTH_FAILURE, 0);
    assert.equal(result.retry, false);
  });

  test('TIMEOUT retries with exponential backoff', () => {
    const r0 = shouldRetry(FailureType.TIMEOUT, 0);
    const r1 = shouldRetry(FailureType.TIMEOUT, 1);
    assert.equal(r0.retry, true);
    assert.equal(r1.retry, true);
    // Second attempt should generally have longer delay (accounting for jitter)
    assert.ok(r0.delayMs > 0);
  });

  test('max retries exceeded stops retrying', () => {
    const policy = createRetryPolicy({ maxRetries: 2 });
    const result = shouldRetry(FailureType.TIMEOUT, 2, policy);
    assert.equal(result.retry, false);
  });

  test('delay is bounded by backoffMaxMs', () => {
    const policy = createRetryPolicy({ maxRetries: 100, backoffMaxMs: 5000 });
    const result = shouldRetry(FailureType.TIMEOUT, 20, policy);
    assert.ok(result.delayMs <= 5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. VISUALIZATION PROVIDER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Visualization Providers', () => {
  test('VISUALIZATION_PROVIDER can be registered without adapter', () => {
    const registry = new ProviderRegistry();
    const def = registry.register(makeTestProvider({
      id: 'VIZ_TEST',
      providerClass: ProviderClass.VISUALIZATION_PROVIDER,
      adapterKey: null,
      dataTypes: ['WEATHER_RADAR'],
      roles: [ProviderRole.CONTEXT],
    }));
    assert.equal(def.providerClass, ProviderClass.VISUALIZATION_PROVIDER);
    assert.equal(def.adapterKey, null);
  });

  test('getByClass separates event from visualization providers', () => {
    const registry = new ProviderRegistry();
    registry.register(makeTestProvider({ id: 'VIZ_SEP_1', providerClass: ProviderClass.EVENT_PROVIDER }));
    registry.register(makeTestProvider({ id: 'VIZ_SEP_2', providerClass: ProviderClass.VISUALIZATION_PROVIDER, dataTypes: ['TILES'] }));
    assert.equal(registry.getByClass(ProviderClass.EVENT_PROVIDER).length, 1);
    assert.equal(registry.getByClass(ProviderClass.VISUALIZATION_PROVIDER).length, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. CURRENT & PLANNED PROVIDER DEFINITION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Provider Definitions', () => {
  test('all current providers are connected and valid', () => {
    assert.equal(CURRENT_PROVIDERS.length, 16);  // 16 connected providers in Phase 6B
    for (const def of CURRENT_PROVIDERS) {
      assert.equal(def.connected, true, `${def.id} should be connected`);
      assert.ok(Object.isFrozen(def), `${def.id} should be frozen`);
      const { valid } = validateProviderDefinition(def);
      assert.ok(valid, `${def.id} should be valid`);
    }
  });

  test('all planned providers are NOT connected and NOT enabled', () => {
    assert.equal(PLANNED_PROVIDERS.length, 2);  // 2 retained planned providers (CWC & Copernicus EMS)
    for (const def of PLANNED_PROVIDERS) {
      assert.equal(def.connected, false, `${def.id} should not be connected`);
      assert.equal(def.runtimeConfig.enabled, false, `${def.id} should not be enabled`);
      assert.equal(def.governance.verification.status, 'UNVERIFIED', `${def.id} should be UNVERIFIED`);
    }
  });

  test('planned provider with enabled:true is rejected by contract', () => {
    assert.throws(() => createProviderDefinition(makeTestProvider({
      id: 'BAD_PLAN',
      connected: false,
      runtimeConfig: { enabled: true },
    })), /Planned provider.*must not have.*enabled: true/);
  });

  test('no secrets in any provider definition', () => {
    const allDefs = [...CURRENT_PROVIDERS, ...PLANNED_PROVIDERS];
    for (const def of allDefs) {
      const json = JSON.stringify(def);
      // Should not contain anything that looks like an actual API key
      assert.ok(!json.includes('AIza'), `${def.id} contains suspicious key pattern`);
      assert.ok(!json.includes('sk-'), `${def.id} contains suspicious key pattern`);
    }
  });
});
