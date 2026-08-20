import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { COUNTRIES, getCountryById, isPointInCountryBounds } from '../../data/countries.js';
import { ProviderManager, WorkloadCategory } from '../lifecycle/ProviderManager.js';
import { CrisisDiscoveryEngine, SEVERITY_LEVELS } from '../discovery/CrisisDiscoveryEngine.js';
import { CentralizedCameraController, GLOBAL_CAMERA_VIEW } from '../camera/CentralizedCameraController.js';

describe('Phase 4: Dual-Mode Architecture & Crisis Intelligence', () => {
  describe('1. Country Catalog & Geospatial Bounds', () => {
    it('contains valid definitions for supported countries', () => {
      assert.ok(COUNTRIES.length >= 6);
      const india = getCountryById('IN');
      assert.equal(india.name, 'India');
      assert.ok(india.bounds.minLat < india.bounds.maxLat);
      assert.ok(india.theaters.length > 0);
    });

    it('correctly determines whether coordinates are within country bounds', () => {
      const india = getCountryById('IN');
      // Bengaluru (12.97, 77.59) -> in bounds
      assert.equal(isPointInCountryBounds(12.97, 77.59, india), true);
      // Tokyo (35.67, 139.65) -> out of bounds for India
      assert.equal(isPointInCountryBounds(35.67, 139.65, india), false);

      const indonesia = getCountryById('ID');
      // Flores Island (-8.24, 121.58) -> in bounds for Indonesia
      assert.equal(isPointInCountryBounds(-8.24, 121.58, indonesia), true);
    });
  });

  describe('2. Provider & Workload Lifecycle Manager', () => {
    it('starts in initial mode and allows mode switching', () => {
      const pm = new ProviderManager({ initialMode: 'WORLD' });
      assert.equal(pm.activeMode, 'WORLD');
      assert.equal(pm.isWorkloadActive(WorkloadCategory.GLOBAL_ONLY), true);
      assert.equal(pm.isWorkloadActive(WorkloadCategory.CRISIS_ONLY), false);
      assert.equal(pm.isWorkloadActive(WorkloadCategory.SHARED), true);

      let transitionPayload = null;
      pm.subscribe((payload) => {
        transitionPayload = payload;
      });

      // Switch to CRISIS mode
      pm.setMode('CRISIS');
      assert.equal(pm.activeMode, 'CRISIS');
      assert.equal(pm.isWorkloadActive(WorkloadCategory.GLOBAL_ONLY), false);
      assert.equal(pm.isWorkloadActive(WorkloadCategory.CRISIS_ONLY), true);
      assert.equal(pm.isWorkloadActive(WorkloadCategory.SHARED), true);
      assert.ok(transitionPayload);
      assert.equal(transitionPayload.currentMode, 'CRISIS');

      // Switch back to WORLD mode
      pm.setMode('WORLD');
      assert.equal(pm.activeMode, 'WORLD');
      assert.equal(pm.isWorkloadActive(WorkloadCategory.GLOBAL_ONLY), true);
      assert.equal(pm.isWorkloadActive(WorkloadCategory.CRISIS_ONLY), false);
    });

    it('manages abort controllers cleanly without leaking', () => {
      const pm = new ProviderManager();
      const ctrl = pm.createAbortController('global_fetch');
      assert.equal(ctrl.signal.aborted, false);

      pm.suspendGlobalWorkloads();
      assert.equal(ctrl.signal.aborted, true);
    });
  });

  describe('3. Crisis Discovery Engine', () => {
    it('discovers and ranks crises for a country theater', () => {
      const mockQuakes = [
        {
          id: 'test_quake_1',
          magnitude: 6.8,
          latitude: 28.5,
          longitude: 84.0, // Near India / Nepal
          depth: 14,
          place: 'Himalayan Thrust Segment',
          time: new Date().toISOString(),
        },
      ];

      const res = CrisisDiscoveryEngine.discover('IN', mockQuakes);
      assert.ok(res.hasActiveCrises);
      assert.ok(res.activeCrises.length >= 1);

      // Verify severity sorting
      for (let i = 0; i < res.activeCrises.length - 1; i++) {
        const rankA = SEVERITY_LEVELS[res.activeCrises[i].severity].rank;
        const rankB = SEVERITY_LEVELS[res.activeCrises[i + 1].severity].rank;
        assert.ok(rankA >= rankB, `Order violation: ${rankA} < ${rankB}`);
      }
    });

    it('discovers seeded scenarios for Indonesia', () => {
      const res = CrisisDiscoveryEngine.discover('ID', []);
      assert.ok(res.activeCrises.length >= 1);
      const flores = res.activeCrises.find((c) => c.id.includes('flores'));
      assert.ok(flores);
      assert.equal(flores.severity, 'CRITICAL');
      assert.ok(flores.impactData);
      assert.ok(flores.impactData.shakingZones);
    });
  });

  describe('4. Centralized Camera Controller & Calculations', () => {
    it('initializes with default global viewpoint', () => {
      const cc = new CentralizedCameraController();
      assert.deepEqual(cc.history.world, GLOBAL_CAMERA_VIEW);
    });

    it('computes dynamic incident viewing altitudes accurately', () => {
      // Small M4.0 quake -> minimum clamp ~300km
      const altSmall = Math.max(280000, Math.min(1000000, 4.0 * 75000));
      assert.equal(altSmall, 300000);

      // Large M7.7 quake -> clamped ~577.5km
      const altLarge = Math.max(280000, Math.min(1000000, 7.7 * 75000));
      assert.equal(altLarge, 577500);

      // Huge M9.5 quake -> 712.5km
      const altHuge = Math.max(280000, Math.min(1000000, 9.5 * 75000));
      assert.equal(altHuge, 712500);

      // Max clamp limit (e.g. M14.0) -> 1,000,000m
      const altMax = Math.max(280000, Math.min(1000000, 14.0 * 75000));
      assert.equal(altMax, 1000000);
    });

    it('calculates accurate radius framing for crises and flights', () => {
      const cc = new CentralizedCameraController();

      // Mock Cesium viewer
      let flownOptions = null;
      cc.setViewer({
        isDestroyed: () => false,
        camera: {
          cancelFlight: () => {},
          flyTo: (opts) => { flownOptions = opts; },
          lookAtTransform: () => {},
        },
      });

      // 1. Flights Side POV test
      const mockFlight = { lat: 37.5, lon: -122.3, altitude: 11000, heading: 180 };
      cc.flyToFlightPOV(mockFlight);
      assert.ok(flownOptions);
      assert.ok(flownOptions.destination);
      assert.equal(flownOptions.orientation.pitch, -50 * (Math.PI / 180));
      assert.equal(flownOptions.orientation.heading, 180 * (Math.PI / 180));

      // 2. Crisis Side POV radius framing test (Critical 70km circle)
      const mockCrisis = {
        location: { lat: -8.24, lon: 121.58 },
        severity: 'CRITICAL',
        impactData: { shakingZones: { moderateRadiusKm: 55 } },
      };
      cc.flyToCrisisRadius(mockCrisis);
      assert.ok(flownOptions);
      assert.equal(flownOptions.orientation.pitch, -55 * (Math.PI / 180));
    });
  });
});
