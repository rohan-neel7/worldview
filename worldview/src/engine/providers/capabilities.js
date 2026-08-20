/**
 * Worldview Data Fabric — Capability Registry
 *
 * Answers: "What can Worldview currently know?"
 *
 * Capability status is derived from ACTUAL RUNTIME CONNECTIVITY and health,
 * not mere definition existence.
 *
 * Rules:
 *   AVAILABLE    — ≥1 connected, enabled, healthy/degraded provider
 *   PARTIAL      — Connected but all providers degraded, or incomplete coverage
 *   PLANNED      — Only planned (not connected) providers exist
 *   UNAVAILABLE  — No providers registered for this capability
 *
 * Example:
 *   NASA FIRMS exists in planned.js → FIRE_DETECTION = PLANNED (not AVAILABLE)
 *   USGS is connected + healthy    → EARTHQUAKE_DETECTION = AVAILABLE
 */

import { CapabilityStatus, ProviderStatus } from './providerTypes.js';

/**
 * Generates a capability ID from data type and role.
 * e.g., ('EARTHQUAKE', 'DETECTION') → 'EARTHQUAKE_DETECTION'
 */
function makeCapabilityId(dataType, role) {
  return `${dataType}_${role}`;
}

/**
 * Determines if a provider health status counts as "operationally active".
 */
function isOperationalHealth(healthStatus) {
  return healthStatus === ProviderStatus.HEALTHY ||
         healthStatus === ProviderStatus.DEGRADED ||
         healthStatus === ProviderStatus.STARTING ||
         healthStatus === ProviderStatus.UNKNOWN; // Unknown = not yet assessed
}

export class CapabilityRegistry {
  /**
   * @param {import('./ProviderRegistry.js').ProviderRegistry} providerRegistry
   * @param {import('./providerHealth.js').ProviderHealthTracker} healthTracker
   */
  constructor(providerRegistry, healthTracker) {
    this.providerRegistry = providerRegistry;
    this.healthTracker = healthTracker;
  }

  /**
   * Evaluates all capabilities from the provider registry.
   * Returns a Map of capability ID → capability object.
   *
   * @returns {Map<string, object>}
   */
  evaluate() {
    const capabilities = new Map();
    const allProviders = this.providerRegistry.getAll();

    for (const provider of allProviders) {
      for (const dataType of provider.dataTypes) {
        for (const role of provider.roles) {
          const capId = makeCapabilityId(dataType, role);

          if (!capabilities.has(capId)) {
            capabilities.set(capId, {
              id: capId,
              dataType,
              role,
              providers: [],
              connectedProviders: [],
              coverageTypes: new Set(),
              status: CapabilityStatus.UNAVAILABLE,
            });
          }

          const cap = capabilities.get(capId);
          cap.providers.push(provider.id);

          if (provider.connected && provider.runtimeConfig.enabled) {
            cap.connectedProviders.push(provider.id);
          }

          cap.coverageTypes.add(provider.coverage.type);
        }
      }
    }

    // Determine status for each capability based on actual connectivity + health
    for (const [, cap] of capabilities) {
      cap.status = this._deriveStatus(cap);
      // Convert Set to Array for serialization
      cap.coverageTypes = Array.from(cap.coverageTypes);
    }

    return capabilities;
  }

  /**
   * Derives capability status based on actual runtime connectivity and health.
   *
   * @param {object} cap
   * @returns {string} CapabilityStatus enum value
   */
  _deriveStatus(cap) {
    if (cap.connectedProviders.length === 0) {
      // No connected providers — check if any planned exist
      return cap.providers.length > 0
        ? CapabilityStatus.PLANNED
        : CapabilityStatus.UNAVAILABLE;
    }

    // Check health of connected providers
    let hasHealthy = false;
    let allDegraded = true;

    for (const providerId of cap.connectedProviders) {
      const health = this.healthTracker.getHealth(providerId);
      if (isOperationalHealth(health.status)) {
        if (health.status === ProviderStatus.HEALTHY || health.status === ProviderStatus.UNKNOWN || health.status === ProviderStatus.STARTING) {
          hasHealthy = true;
          allDegraded = false;
        }
      } else {
        // FAILED or DISABLED
      }
    }

    if (hasHealthy) return CapabilityStatus.AVAILABLE;
    if (allDegraded && cap.connectedProviders.length > 0) return CapabilityStatus.PARTIAL;
    return CapabilityStatus.PARTIAL;
  }

  /**
   * Get a single capability by ID.
   *
   * @param {string} capabilityId
   * @returns {object|null}
   */
  getCapability(capabilityId) {
    const all = this.evaluate();
    return all.get(capabilityId) || null;
  }

  /**
   * Get all capabilities as an array.
   *
   * @returns {Array<object>}
   */
  getAll() {
    return Array.from(this.evaluate().values());
  }

  /**
   * Get only capabilities with AVAILABLE status.
   *
   * @returns {Array<object>}
   */
  getAvailable() {
    return this.getAll().filter((c) => c.status === CapabilityStatus.AVAILABLE);
  }

  /**
   * Get a summary snapshot for developer inspection.
   *
   * @returns {object}
   */
  getSnapshot() {
    const all = this.getAll();
    const snapshot = {
      totalCapabilities: all.length,
      available: 0,
      partial: 0,
      planned: 0,
      unavailable: 0,
      capabilities: {},
    };

    for (const cap of all) {
      snapshot.capabilities[cap.id] = {
        dataType: cap.dataType,
        role: cap.role,
        status: cap.status,
        providers: cap.providers,
        connectedProviders: cap.connectedProviders,
        coverageTypes: cap.coverageTypes,
      };

      switch (cap.status) {
        case CapabilityStatus.AVAILABLE: snapshot.available++; break;
        case CapabilityStatus.PARTIAL: snapshot.partial++; break;
        case CapabilityStatus.PLANNED: snapshot.planned++; break;
        case CapabilityStatus.UNAVAILABLE: snapshot.unavailable++; break;
      }
    }

    return snapshot;
  }
}
