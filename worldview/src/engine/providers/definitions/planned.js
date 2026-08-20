/**
 * Worldview Data Fabric — Planned Provider Definitions
 *
 * Planned providers retained for future integration waves:
 *   - CWC_FLOOD: Central Water Commission River-Basin Gauges (India)
 *   - COPERNICUS_EMS: Copernicus Emergency Rapid Mapping Activations (Global)
 *
 * Hard isolation rules:
 *   - connected: false
 *   - runtimeConfig.enabled: false
 *   - governance.verification.status: 'UNVERIFIED'
 *
 * A planned provider MUST NOT:
 *   - Start / Poll / Emit events
 *   - Influence live risk or triage as AVAILABLE
 */

import { createProviderDefinition } from '../ProviderContract.js';
import {
  ProviderTier,
  ProviderRole,
  DataState,
  CoverageType,
  TemporalResolution,
  AuthType,
  LicenseStatus,
  AccessType,
  ProviderOwnership,
  ProviderClass,
} from '../providerTypes.js';
import { SourceMode } from '../../event/types.js';

export const CWC_FLOOD = createProviderDefinition({
  id: 'CWC_FLOOD',
  name: 'Central Water Commission Flood Monitoring',
  organization: 'CWC / MoJSWR India',
  tier: ProviderTier.TIER_A,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['FLOOD_SIGNAL', 'WATER_LEVEL_OBSERVATION'],
  roles: [ProviderRole.DETECTION, ProviderRole.FORECAST, ProviderRole.OFFICIAL_WARNING],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.CRISIS,
  adapterKey: null,
  version: '1.0',
  connected: false,
  coverage: { type: CoverageType.COUNTRY, countries: ['IN'] },
  temporalResolution: {
    type: TemporalResolution.HOURLY,
    expectedFreshnessMs: 3600000,
    expectedLatencyMs: 10000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 600000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 1,
    enabled: false,
  },
  governance: {
    auth: { type: AuthType.UNKNOWN, secretRef: null },
    license: {
      status: LicenseStatus.UNKNOWN,
      accessType: AccessType.GOVERNMENT,
      attribution: 'Central Water Commission, India',
      redistribution: null,
    },
    verification: {
      status: 'UNVERIFIED',
      verifiedAt: null,
      verificationSource: null,
      accessNotes: 'CWC real-time gauge telemetry — API access and format to be verified',
      limitations: 'Unknown — requires direct CWC integration',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

export const COPERNICUS_EMS = createProviderDefinition({
  id: 'COPERNICUS_EMS',
  name: 'Copernicus Emergency Management Service',
  organization: 'ESA / EU JRC',
  tier: ProviderTier.TIER_B,
  providerClass: ProviderClass.EVENT_PROVIDER,
  dataTypes: ['FLOOD_SIGNAL', 'WILDFIRE_HOTSPOT', 'EARTHQUAKE'],
  roles: [ProviderRole.DETECTION, ProviderRole.IMPACT],
  dataState: DataState.OBSERVED,
  sourceMode: SourceMode.LIVE,
  ownership: ProviderOwnership.CRISIS,
  adapterKey: null,
  version: '1.0',
  connected: false,
  coverage: { type: CoverageType.GLOBAL },
  temporalResolution: {
    type: TemporalResolution.HOURLY,
    expectedFreshnessMs: 3600000,
    expectedLatencyMs: 10000,
  },
  runtimeConfig: {
    timeoutMs: 15000,
    pollIntervalMs: 1800000,
    maxRetries: 3,
    backoffBaseMs: 2000,
    backoffMaxMs: 60000,
    rateLimitPerMinute: null,
    priority: 2,
    enabled: false,
  },
  governance: {
    auth: { type: AuthType.UNKNOWN, secretRef: null },
    license: {
      status: LicenseStatus.UNKNOWN,
      accessType: AccessType.OPEN,
      attribution: 'Copernicus EMS (https://emergency.copernicus.eu)',
      redistribution: null,
    },
    verification: {
      status: 'UNVERIFIED',
      verifiedAt: null,
      verificationSource: null,
      accessNotes: 'Rapid Mapping & Risk/Recovery activations — API to be verified',
      limitations: 'Activation-based service; not continuous monitoring',
    },
  },
  fallback: { providerId: null, strategy: null, degradationNotice: null },
});

export const PLANNED_PROVIDERS = [
  CWC_FLOOD,
  COPERNICUS_EMS,
];
