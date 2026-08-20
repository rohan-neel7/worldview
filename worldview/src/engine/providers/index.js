/**
 * Worldview Data Fabric — Provider System Barrel Export
 *
 * Singleton instantiation of registry, health tracker, data fabric,
 * capability registry, and lifecycle manager.
 *
 * Architecture:
 *   ProviderRegistry     → immutable definitions, metadata, queries
 *   ProviderHealthTracker → mutable runtime health state
 *   DataFabric            → orchestration layer → delegates to DataPipeline
 *   CapabilityRegistry    → derives capabilities from actual connectivity
 *   ProviderLifecycleManager → lifecycle contracts used BY ProviderManager
 */

// ── Types ────────────────────────────────────────────────────────────────────
export {
  ProviderTier,
  ProviderRole,
  DataState,
  ProviderStatus,
  CoverageType,
  TemporalResolution,
  AuthType,
  LicenseStatus,
  AccessType,
  CapabilityStatus,
  ProviderOwnership,
  FailureType,
  ProviderClass,
  LifecycleState,
} from './providerTypes.js';

// ── Contract ─────────────────────────────────────────────────────────────────
export { createProviderDefinition, validateProviderDefinition } from './ProviderContract.js';

// ── Health ───────────────────────────────────────────────────────────────────
export { ProviderHealthTracker } from './providerHealth.js';

// ── Coverage ─────────────────────────────────────────────────────────────────
export { matchesCoverage, isWithinBbox, isWithinRadius } from './coverage.js';

// ── Retry Policy ─────────────────────────────────────────────────────────────
export { createRetryPolicy, shouldRetry } from './retryPolicy.js';

// ── Data Quality ─────────────────────────────────────────────────────────────
export { computeDataQuality } from './dataQuality.js';

// ── Registry ─────────────────────────────────────────────────────────────────
export { ProviderRegistry } from './ProviderRegistry.js';

// ── Capabilities ─────────────────────────────────────────────────────────────
export { CapabilityRegistry } from './capabilities.js';

// ── Data Fabric ──────────────────────────────────────────────────────────────
export { DataFabric } from './DataFabric.js';

// ── Lifecycle ────────────────────────────────────────────────────────────────
export { ProviderLifecycleContract, ProviderLifecycleManager } from './lifecycle.js';

// ── Definitions ──────────────────────────────────────────────────────────────
export { CURRENT_PROVIDERS } from './definitions/current.js';
export { PLANNED_PROVIDERS } from './definitions/planned.js';

// ── Baseline Geospatial Services ─────────────────────────────────────────────
export { WorldPopService, globalWorldPopService } from '../services/WorldPopService.js';
export { CopernicusDEMService, globalCopernicusDEMService } from '../services/CopernicusDEMService.js';

// ── Singleton Instantiation ──────────────────────────────────────────────────
import { ProviderRegistry } from './ProviderRegistry.js';
import { ProviderHealthTracker } from './providerHealth.js';
import { DataFabric } from './DataFabric.js';
import { CapabilityRegistry } from './capabilities.js';
import { ProviderLifecycleManager } from './lifecycle.js';
import { globalDataPipeline } from '../pipeline/DataPipeline.js';
import { CURRENT_PROVIDERS } from './definitions/current.js';
import { PLANNED_PROVIDERS } from './definitions/planned.js';

// 1. Provider Registry — metadata/control infrastructure
export const globalProviderRegistry = new ProviderRegistry();

// Register all current (connected) providers
for (const def of CURRENT_PROVIDERS) {
  globalProviderRegistry.register(def);
}

// Register all planned (not connected) providers
for (const def of PLANNED_PROVIDERS) {
  globalProviderRegistry.register(def);
}

// 2. Provider Health Tracker — mutable runtime state
export const globalProviderHealthTracker = new ProviderHealthTracker();

// 3. Data Fabric — orchestration layer (delegates to existing DataPipeline)
export const globalDataFabric = new DataFabric({
  providerRegistry: globalProviderRegistry,
  healthTracker: globalProviderHealthTracker,
  dataPipeline: globalDataPipeline,
});

// 4. Capability Registry — derives from actual connectivity + health
export const globalCapabilityRegistry = new CapabilityRegistry(
  globalProviderRegistry,
  globalProviderHealthTracker
);

// 5. Provider Lifecycle Manager — contracts used BY ProviderManager
export const globalProviderLifecycleManager = new ProviderLifecycleManager();
