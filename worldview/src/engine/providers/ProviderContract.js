/**
 * Worldview Data Fabric — Provider Contract
 *
 * Creates and validates IMMUTABLE provider definitions.
 * Definitions are separated into clear conceptual boundaries:
 *   - Identity (static metadata)
 *   - Coverage (geographic + temporal)
 *   - RuntimeConfig (timeout, retry, polling — immutable defaults)
 *   - Governance (auth, license, verification)
 *   - Fallback (strategy, degradation notice)
 *
 * Provider definitions are Object.freeze()'d — runtime mutation is impossible.
 * Runtime state belongs in ProviderHealthTracker, not in definitions.
 *
 * SECURITY: Definitions NEVER contain actual secret values.
 * Only secretRef (a reference name) is allowed.
 */

import {
  ProviderTier,
  ProviderRole,
  DataState,
  ProviderStatus,
  CoverageType,
  TemporalResolution,
  AuthType,
  LicenseStatus,
  AccessType,
  ProviderOwnership,
  ProviderClass,
} from './providerTypes.js';
import { SourceMode } from '../event/types.js';

const SENSITIVE_KEY_PATTERN = /api[_-]?key|token|secret|password|bearer|credential/i;

/**
 * Deep-freeze an object and all nested objects.
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Checks whether a string looks like an actual secret value
 * (long alphanumeric strings, base64-like patterns).
 * secretRef should be short reference names like 'AISSTREAM_API_KEY'.
 */
function looksLikeSecret(value) {
  if (typeof value !== 'string') return false;
  // Reject values that look like actual keys/tokens (long encoded strings)
  if (value.length > 60 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return true;
  // Reject values starting with common key prefixes
  if (/^(AIza|sk-|pk_|rk_|Bearer\s)/i.test(value)) return true;
  return false;
}

/**
 * Validates a provider definition and returns { valid, errors }.
 *
 * @param {object} def - The provider definition to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProviderDefinition(def) {
  const errors = [];

  if (!def || typeof def !== 'object') {
    return { valid: false, errors: ['Provider definition must be a non-null object'] };
  }

  // ── Identity validation ──
  if (!def.id || typeof def.id !== 'string' || def.id.trim() === '') {
    errors.push('Provider "id" must be a non-empty string');
  }
  if (!def.name || typeof def.name !== 'string') {
    errors.push('Provider "name" must be a non-empty string');
  }
  if (!def.organization || typeof def.organization !== 'string') {
    errors.push('Provider "organization" must be a non-empty string');
  }
  if (!Object.values(ProviderTier).includes(def.tier)) {
    errors.push(`Provider "tier" must be one of: ${Object.values(ProviderTier).join(', ')}`);
  }
  if (!Object.values(ProviderClass).includes(def.providerClass)) {
    errors.push(`Provider "providerClass" must be one of: ${Object.values(ProviderClass).join(', ')}`);
  }
  if (!Array.isArray(def.dataTypes) || def.dataTypes.length === 0) {
    errors.push('Provider "dataTypes" must be a non-empty array');
  }
  if (!Array.isArray(def.roles) || def.roles.length === 0) {
    errors.push('Provider "roles" must be a non-empty array');
  } else {
    for (const role of def.roles) {
      if (!Object.values(ProviderRole).includes(role)) {
        errors.push(`Invalid provider role: "${role}"`);
      }
    }
  }
  if (!Object.values(DataState).includes(def.dataState)) {
    errors.push(`Provider "dataState" must be one of: ${Object.values(DataState).join(', ')}`);
  }
  if (!Object.values(SourceMode).includes(def.sourceMode)) {
    errors.push(`Provider "sourceMode" must be one of: ${Object.values(SourceMode).join(', ')}`);
  }
  if (!Object.values(ProviderOwnership).includes(def.ownership)) {
    errors.push(`Provider "ownership" must be one of: ${Object.values(ProviderOwnership).join(', ')}`);
  }
  if (typeof def.connected !== 'boolean') {
    errors.push('Provider "connected" must be a boolean');
  }

  // ── Coverage validation ──
  if (!def.coverage || typeof def.coverage !== 'object') {
    errors.push('Provider "coverage" must be an object');
  } else if (!Object.values(CoverageType).includes(def.coverage.type)) {
    errors.push(`Coverage "type" must be one of: ${Object.values(CoverageType).join(', ')}`);
  }

  // ── Temporal resolution validation ──
  if (!def.temporalResolution || typeof def.temporalResolution !== 'object') {
    errors.push('Provider "temporalResolution" must be an object');
  } else if (!Object.values(TemporalResolution).includes(def.temporalResolution.type)) {
    errors.push(`Temporal resolution "type" must be one of: ${Object.values(TemporalResolution).join(', ')}`);
  }

  // ── Governance validation ──
  if (!def.governance || typeof def.governance !== 'object') {
    errors.push('Provider "governance" must be an object');
  } else {
    // Auth
    if (!def.governance.auth || !Object.values(AuthType).includes(def.governance.auth.type)) {
      errors.push(`Governance auth "type" must be one of: ${Object.values(AuthType).join(', ')}`);
    }
    // Check secretRef is not an actual secret
    if (def.governance.auth?.secretRef && looksLikeSecret(def.governance.auth.secretRef)) {
      errors.push('Governance auth "secretRef" appears to contain an actual secret value — use a reference name instead');
    }
    // License
    if (!def.governance.license || !Object.values(LicenseStatus).includes(def.governance.license.status)) {
      errors.push(`Governance license "status" must be one of: ${Object.values(LicenseStatus).join(', ')}`);
    }
  }

  // ── Scan all string values for exposed secrets ──
  const scanForSecrets = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (SENSITIVE_KEY_PATTERN.test(key) && typeof val === 'string' && val.length > 0) {
        // secretRef is allowed as a reference name
        if (key === 'secretRef') continue;
        errors.push(`Provider definition must not contain sensitive key "${fullPath}"`);
      }
      if (typeof val === 'string' && looksLikeSecret(val)) {
        errors.push(`Value at "${fullPath}" appears to contain an actual secret`);
      }
      if (typeof val === 'object' && val !== null) {
        scanForSecrets(val, fullPath);
      }
    }
  };
  scanForSecrets(def);

  // ── Planned provider isolation ──
  if (def.connected === false) {
    // Planned providers must not have runtimeConfig.enabled = true
    if (def.runtimeConfig?.enabled === true) {
      errors.push('Planned provider (connected: false) must not have runtimeConfig.enabled: true');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates an immutable provider definition from configuration.
 * Applies defaults, validates, and deep-freezes the result.
 *
 * @param {object} config - Provider configuration
 * @returns {object} Frozen provider definition
 * @throws {Error} If validation fails
 */
export function createProviderDefinition(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createProviderDefinition requires a configuration object');
  }

  const def = {
    // ── Identity ──
    id: config.id,
    name: config.name,
    organization: config.organization,
    tier: config.tier,
    providerClass: config.providerClass || ProviderClass.EVENT_PROVIDER,
    dataTypes: Array.isArray(config.dataTypes) ? [...config.dataTypes] : [],
    roles: Array.isArray(config.roles) ? [...config.roles] : [],
    dataState: config.dataState || DataState.UNKNOWN,
    sourceMode: config.sourceMode || SourceMode.LIVE,
    ownership: config.ownership || ProviderOwnership.SHARED,
    adapterKey: config.adapterKey || null,
    version: config.version || '1.0',
    connected: typeof config.connected === 'boolean' ? config.connected : false,

    // ── Coverage ──
    coverage: {
      type: config.coverage?.type || CoverageType.UNKNOWN,
      countries: config.coverage?.countries ? [...config.coverage.countries] : null,
      bbox: config.coverage?.bbox ? { ...config.coverage.bbox } : null,
      polygon: config.coverage?.polygon || null,
    },

    // ── Temporal Resolution ──
    temporalResolution: {
      type: config.temporalResolution?.type || TemporalResolution.UNKNOWN,
      expectedFreshnessMs: config.temporalResolution?.expectedFreshnessMs || 300000,
      expectedLatencyMs: config.temporalResolution?.expectedLatencyMs || 5000,
    },

    // ── Runtime Configuration (immutable defaults) ──
    runtimeConfig: {
      timeoutMs: config.runtimeConfig?.timeoutMs || 10000,
      pollIntervalMs: config.runtimeConfig?.pollIntervalMs || 300000,
      maxRetries: config.runtimeConfig?.maxRetries ?? 3,
      backoffBaseMs: config.runtimeConfig?.backoffBaseMs || 1000,
      backoffMaxMs: config.runtimeConfig?.backoffMaxMs || 60000,
      rateLimitPerMinute: config.runtimeConfig?.rateLimitPerMinute || null,
      priority: config.runtimeConfig?.priority ?? 1,
      enabled: config.runtimeConfig?.enabled ?? true,
    },

    // ── Governance ──
    governance: {
      auth: {
        type: config.governance?.auth?.type || AuthType.UNKNOWN,
        secretRef: config.governance?.auth?.secretRef || null,
      },
      license: {
        status: config.governance?.license?.status || LicenseStatus.UNKNOWN,
        accessType: config.governance?.license?.accessType || AccessType.UNKNOWN,
        attribution: config.governance?.license?.attribution || null,
        redistribution: config.governance?.license?.redistribution || null,
      },
      verification: {
        status: config.governance?.verification?.status || 'UNVERIFIED',
        verifiedAt: config.governance?.verification?.verifiedAt || null,
        verificationSource: config.governance?.verification?.verificationSource || null,
        accessNotes: config.governance?.verification?.accessNotes || null,
        limitations: config.governance?.verification?.limitations || null,
      },
    },

    // ── Fallback ──
    fallback: {
      providerId: config.fallback?.providerId || null,
      strategy: config.fallback?.strategy || null,
      degradationNotice: config.fallback?.degradationNotice || null,
    },
  };

  const { valid, errors } = validateProviderDefinition(def);
  if (!valid) {
    throw new Error(`Provider definition validation failed for "${config.id || 'unknown'}": ${errors.join('; ')}`);
  }

  return deepFreeze(def);
}
