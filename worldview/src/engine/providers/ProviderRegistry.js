/**
 * Worldview Data Fabric — Provider Registry
 *
 * Central metadata registry for all data providers (current and planned).
 * Stores immutable provider definitions in a Map<id, ProviderDefinition>.
 *
 * The registry is metadata/control infrastructure. It does NOT:
 *   - Poll providers
 *   - Create timers or WebSockets
 *   - Perform network requests
 *   - Maintain React state
 *   - Store runtime health (that's ProviderHealthTracker)
 *   - Store events (that's DataPipeline)
 *
 * The registry IS responsible for:
 *   - Registration and duplicate prevention
 *   - Metadata lookup and queries
 *   - Enable/disable configuration
 *   - Coverage queries
 *   - Planned provider enforcement
 *   - Developer-accessible snapshots
 */

import { createProviderDefinition, validateProviderDefinition } from './ProviderContract.js';
import { matchesCoverage } from './coverage.js';

export class ProviderRegistry {
  constructor() {
    /** @type {Map<string, object>} */
    this.providers = new Map();
  }

  /**
   * Register a provider definition.
   * Validates, freezes, and stores. Rejects duplicate IDs.
   *
   * @param {object} configOrDef - Provider config (will be validated and frozen)
   * @returns {object} The registered (frozen) definition
   * @throws {Error} If duplicate ID or validation failure
   */
  register(configOrDef) {
    // If already frozen and validated, use directly; otherwise create through contract
    let def;
    const { valid } = validateProviderDefinition(configOrDef);
    if (valid && Object.isFrozen(configOrDef)) {
      def = configOrDef;
    } else {
      def = createProviderDefinition(configOrDef);
    }

    if (this.providers.has(def.id)) {
      throw new Error(`Provider with ID "${def.id}" is already registered`);
    }

    this.providers.set(def.id, def);
    return def;
  }

  /**
   * Unregister a provider by ID.
   *
   * @param {string} id
   * @returns {boolean} True if the provider was found and removed
   */
  unregister(id) {
    return this.providers.delete(id);
  }

  /**
   * Get a provider definition by ID.
   *
   * @param {string} id
   * @returns {object|null} Frozen provider definition or null
   */
  get(id) {
    return this.providers.get(id) || null;
  }

  /**
   * Get all registered provider definitions.
   *
   * @returns {Array<object>}
   */
  getAll() {
    return Array.from(this.providers.values());
  }

  /**
   * Get all enabled provider definitions.
   *
   * @returns {Array<object>}
   */
  getEnabled() {
    return this.getAll().filter((p) => p.runtimeConfig.enabled);
  }

  /**
   * Get all connected (non-planned) provider definitions.
   *
   * @returns {Array<object>}
   */
  getConnected() {
    return this.getAll().filter((p) => p.connected === true);
  }

  /**
   * Get all planned (not connected) provider definitions.
   *
   * @returns {Array<object>}
   */
  getPlanned() {
    return this.getAll().filter((p) => p.connected === false);
  }

  /**
   * Check if a provider is planned (not connected).
   *
   * @param {string} id
   * @returns {boolean}
   */
  isPlanned(id) {
    const def = this.get(id);
    return def ? def.connected === false : false;
  }

  /**
   * Get providers filtered by tier.
   *
   * @param {string} tier - ProviderTier enum value
   * @returns {Array<object>}
   */
  getByTier(tier) {
    return this.getAll().filter((p) => p.tier === tier);
  }

  /**
   * Get providers that have a specific role.
   *
   * @param {string} role - ProviderRole enum value
   * @returns {Array<object>}
   */
  getByRole(role) {
    return this.getAll().filter((p) => p.roles.includes(role));
  }

  /**
   * Get providers that supply a specific data type.
   *
   * @param {string} dataType
   * @returns {Array<object>}
   */
  getByDataType(dataType) {
    return this.getAll().filter((p) => p.dataTypes.includes(dataType));
  }

  /**
   * Get providers filtered by ownership.
   *
   * @param {string} ownership - ProviderOwnership enum value
   * @returns {Array<object>}
   */
  getByOwnership(ownership) {
    return this.getAll().filter((p) => p.ownership === ownership);
  }

  /**
   * Get providers filtered by provider class (EVENT_PROVIDER / VISUALIZATION_PROVIDER).
   *
   * @param {string} providerClass - ProviderClass enum value
   * @returns {Array<object>}
   */
  getByClass(providerClass) {
    return this.getAll().filter((p) => p.providerClass === providerClass);
  }

  /**
   * Enable a provider by ID.
   * Creates a new frozen definition with enabled=true, replacing the old one.
   *
   * @param {string} id
   * @returns {boolean} True if the provider was found and updated
   */
  enable(id) {
    const def = this.get(id);
    if (!def) return false;
    // Planned providers cannot be enabled
    if (!def.connected) return false;

    const updated = createProviderDefinition({
      ...def,
      runtimeConfig: { ...def.runtimeConfig, enabled: true },
    });
    this.providers.set(id, updated);
    return true;
  }

  /**
   * Disable a provider by ID.
   * Creates a new frozen definition with enabled=false, replacing the old one.
   *
   * @param {string} id
   * @returns {boolean} True if the provider was found and updated
   */
  disable(id) {
    const def = this.get(id);
    if (!def) return false;

    const updated = createProviderDefinition({
      ...def,
      runtimeConfig: { ...def.runtimeConfig, enabled: false },
    });
    this.providers.set(id, updated);
    return true;
  }

  /**
   * Get all providers whose coverage includes the given location.
   *
   * @param {number} lat
   * @param {number} lon
   * @returns {Array<object>}
   */
  getProvidersForLocation(lat, lon) {
    return this.getAll().filter((p) => matchesCoverage(p, { lat, lon }));
  }

  /**
   * Get a full snapshot of the registry for developer inspection.
   * Returns plain objects — no references to internal state.
   *
   * @returns {object}
   */
  getSnapshot() {
    const snapshot = {
      totalProviders: this.providers.size,
      connected: 0,
      planned: 0,
      enabled: 0,
      disabled: 0,
      providers: {},
    };

    for (const [id, def] of this.providers) {
      snapshot.providers[id] = {
        name: def.name,
        tier: def.tier,
        providerClass: def.providerClass,
        dataTypes: [...def.dataTypes],
        roles: [...def.roles],
        dataState: def.dataState,
        sourceMode: def.sourceMode,
        ownership: def.ownership,
        connected: def.connected,
        enabled: def.runtimeConfig.enabled,
        coverageType: def.coverage.type,
        authType: def.governance.auth.type,
        licenseStatus: def.governance.license.status,
        verificationStatus: def.governance.verification.status,
        fallbackProvider: def.fallback.providerId,
      };

      if (def.connected) snapshot.connected++;
      else snapshot.planned++;
      if (def.runtimeConfig.enabled) snapshot.enabled++;
      else snapshot.disabled++;
    }

    return snapshot;
  }

  /**
   * Get the count of registered providers.
   *
   * @returns {number}
   */
  get size() {
    return this.providers.size;
  }
}
