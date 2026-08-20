/**
 * Country-Level Crisis Discovery Engine
 * Scans canonical pipeline incident states and validated scenario models
 * bounded to any selected country theater.
 *
 * Produces severity-sorted crisis discovery streams with deterministic risk scoring.
 *
 * Adheres to Phase 6C-H Rules:
 *   - ACTIVE CRISIS COUNT REPRESENTS UNIQUE INCIDENTS (not raw sensor counts).
 *   - STRICT LIVE/SYNTHETIC ISOLATION: Seeded crises carry dataState: SYNTHETIC, sourceMode: SIMULATED.
 *   - Single source of truth for severity thresholds via centralized SEVERITY_THRESHOLDS.
 */

import { getCountryById, isPointInCountryBounds } from '../../data/countries.js';
import { EarthquakeImpactEngine } from '../impact/EarthquakeImpactEngine.js';
import { globalDataPipeline, BENGALURU_FLOOD_SCENARIO } from '../index.js';
import { SEVERITY_THRESHOLDS, scoreToSeverity } from '../risk/severityPolicy.js';
import { SourceMode } from '../event/types.js';
import { DataState } from '../providers/providerTypes.js';

export const SEVERITY_LEVELS = SEVERITY_THRESHOLDS;

// Seeded/Scenario Disasters for rich country discovery demonstration
// Strictly isolated: sourceMode: SIMULATED, dataState: SYNTHETIC
export const SEEDED_COUNTRY_CRISES = {
  ID: [
    {
      id: 'sim-earthquake-flores-m77',
      type: 'EARTHQUAKE',
      title: 'M7.7 Flores Sea Scenario',
      location: {
        name: '68 km NNW of Ende, Flores Island',
        lat: -8.24,
        lon: 121.58,
        depthKm: 12.0,
      },
      magnitude: 7.7,
      riskScore: 84,
      severity: 'CRITICAL',
      eventConfidence: 0.98,
      assessmentConfidence: 0.74,
      freshness: 'RECENT',
      source: 'Scenario Baseline / BMKG Geodetic Net',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date().toISOString(),
    },
    {
      id: 'sim-tsunami-sunda-alert',
      type: 'TSUNAMI',
      title: 'Sunda Strait Perturbation Scenario',
      location: {
        name: 'Krakatau Trench Corridor',
        lat: -6.10,
        lon: 105.42,
        depthKm: 5.0,
      },
      magnitude: 6.2,
      riskScore: 68,
      severity: 'HIGH',
      eventConfidence: 0.85,
      assessmentConfidence: 0.62,
      freshness: 'RECENT',
      source: 'InaTEWS Scenario Model',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  IN: [
    {
      id: 'sim-flood-bengaluru-scenario',
      type: 'FLOOD',
      title: 'Bengaluru Urban Basin Inundation Scenario',
      location: {
        name: 'Bellandur / Outer Ring Road Corridor',
        lat: 12.9352,
        lon: 77.6245,
        depthKm: 0.0,
      },
      riskScore: 78,
      severity: 'HIGH',
      eventConfidence: 0.92,
      assessmentConfidence: 0.79,
      freshness: 'RECENT',
      source: 'KSNDMC / IMD Radar Simulation',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date().toISOString(),
      scenarioData: BENGALURU_FLOOD_SCENARIO,
    },
    {
      id: 'sim-seismic-himalayan-frontal',
      type: 'EARTHQUAKE',
      title: 'M5.8 Uttarakhand Main Central Thrust Scenario',
      location: {
        name: '32 km E of Chamoli, Uttarakhand',
        lat: 30.40,
        lon: 79.35,
        depthKm: 15.0,
      },
      magnitude: 5.8,
      riskScore: 62,
      severity: 'HIGH',
      eventConfidence: 0.96,
      assessmentConfidence: 0.71,
      freshness: 'RECENT',
      source: 'NCS Baseline Simulation',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
  JP: [
    {
      id: 'sim-seismic-nankai-trough',
      type: 'EARTHQUAKE',
      title: 'M7.4 Nankai Trough Scenario Cluster',
      location: {
        name: '85 km SE of Shionomisaki, Wakayama',
        lat: 33.15,
        lon: 136.20,
        depthKm: 22.0,
      },
      magnitude: 7.4,
      riskScore: 88,
      severity: 'CRITICAL',
      eventConfidence: 0.99,
      assessmentConfidence: 0.81,
      freshness: 'RECENT',
      source: 'JMA Scenario Model',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date().toISOString(),
    },
  ],
  US: [
    {
      id: 'sim-seismic-ridgecrest-cluster',
      type: 'EARTHQUAKE',
      title: 'M6.4 Eastern California Shear Zone Scenario',
      location: {
        name: '18 km SW of Searles Valley, CA',
        lat: 35.71,
        lon: -117.51,
        depthKm: 8.0,
      },
      magnitude: 6.4,
      riskScore: 65,
      severity: 'HIGH',
      eventConfidence: 0.98,
      assessmentConfidence: 0.75,
      freshness: 'RECENT',
      source: 'USGS Scenario Model',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date(Date.now() - 5400000).toISOString(),
    },
  ],
  TR: [
    {
      id: 'sim-seismic-east-anatolian-m72',
      type: 'EARTHQUAKE',
      title: 'M7.2 East Anatolian Fault Rupture Scenario',
      location: {
        name: '24 km W of Pazarcık, Kahramanmaraş',
        lat: 37.52,
        lon: 36.85,
        depthKm: 10.0,
      },
      magnitude: 7.2,
      riskScore: 86,
      severity: 'CRITICAL',
      eventConfidence: 0.98,
      assessmentConfidence: 0.77,
      freshness: 'RECENT',
      source: 'AFAD Scenario Model',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date().toISOString(),
    },
  ],
  PH: [
    {
      id: 'sim-storm-philippine-typhoon',
      type: 'CYCLONE',
      title: 'Cat-4 Super Typhoon Coastal Inundation Scenario',
      location: {
        name: 'Samar / Leyte Coastal Gateway',
        lat: 11.24,
        lon: 125.00,
        depthKm: 0.0,
      },
      riskScore: 82,
      severity: 'CRITICAL',
      eventConfidence: 0.94,
      assessmentConfidence: 0.76,
      freshness: 'RECENT',
      source: 'PAGASA Scenario Model',
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      timestamp: new Date().toISOString(),
    },
  ],
};

export class CrisisDiscoveryEngine {
  /**
   * Discover and rank unique active crises for a specific country theater.
   *
   * @param {string | object} countryOrId - Country ID ('IN', 'ID', etc.) or country object
   * @param {Array<object>} [_liveEarthquakes=[]] - Unused; raw telemetry is ingested into DataPipeline
   * @returns {object} { country, timestamp, activeCrises, totalCount, criticalCount }
   */
  static discover(countryOrId, _liveEarthquakes = []) {
    const country = typeof countryOrId === 'string' ? getCountryById(countryOrId) : countryOrId;
    const countryId = country.id;

    const activeCrises = [];
    const seenIncidentIds = new Set();

    // 1. Ingest canonical active incidents from the pipeline that match country bounds
    const pipelineIncidents = globalDataPipeline.getActiveIncidents();
    for (const inc of pipelineIncidents) {
      const loc = inc.location;
      if (loc && isPointInCountryBounds(loc.lat, loc.lon, country)) {
        if (!seenIncidentIds.has(inc.id)) {
          activeCrises.push(this.normalizePipelineIncident(inc));
          seenIncidentIds.add(inc.id);
        }
      }
    }

    // 2. If 0 live incidents in this country theater, load synthetic scenario baseline for demonstration
    // Strictly tagged sourceMode: SIMULATED, dataState: SYNTHETIC (never merged with live)
    if (activeCrises.length === 0) {
      const seeded = SEEDED_COUNTRY_CRISES[countryId] || [];
      for (const s of seeded) {
        if (!seenIncidentIds.has(s.id)) {
          activeCrises.push(this.enrichSeededCrisis(s));
          seenIncidentIds.add(s.id);
        }
      }
    }

    // 3. Deterministic Severity Sorting (CRITICAL > HIGH > MODERATE > LOW, then risk score)
    activeCrises.sort((a, b) => {
      const rankA = SEVERITY_THRESHOLDS[a.severity]?.rank || 1;
      const rankB = SEVERITY_THRESHOLDS[b.severity]?.rank || 1;
      if (rankB !== rankA) return rankB - rankA;
      return (b.riskScore || 0) - (a.riskScore || 0);
    });

    const criticalCount = activeCrises.filter((c) => c.severity === 'CRITICAL').length;
    const highCount = activeCrises.filter((c) => c.severity === 'HIGH').length;

    return {
      country,
      timestamp: new Date().toISOString(),
      activeCrises,
      totalCount: activeCrises.length,
      criticalCount,
      highCount,
      hasActiveCrises: activeCrises.length > 0,
    };
  }

  static normalizePipelineIncident(inc) {
    const mag = inc.evidence?.[0]?.metrics?.magnitude || inc.location?.magnitude || 5.0;
    const depth = inc.location?.depthKm || 10;
    const lat = inc.location?.lat;
    const lon = inc.location?.lon;
    const place = inc.location?.name || inc.title;

    let impactData = inc.impactData;
    if (!impactData && lat != null && lon != null) {
      impactData = EarthquakeImpactEngine.evaluate({
        magnitude: mag,
        depthKm: depth,
        lat,
        lon,
        place,
      });
    }

    const riskScore = inc.risk?.score || (mag >= 7.0 ? 85 : mag >= 6.0 ? 70 : 45);
    const severity = inc.risk?.severity || inc.severity || scoreToSeverity(riskScore);

    return {
      id: inc.id,
      type: inc.type || 'EARTHQUAKE',
      title: inc.title,
      location: inc.location,
      magnitude: mag,
      riskScore,
      severity,
      eventConfidence: inc.confidence || 0.95,
      assessmentConfidence: inc.risk?.confidence || inc.confidence || 0.74,
      freshness: 'LIVE',
      source: inc.evidence?.[0]?.source || 'Data Pipeline Fusion',
      sourceMode: inc.sourceMode || SourceMode.LIVE,
      dataState: inc.dataState || DataState.OBSERVED,
      timestamp: inc.updatedAt || new Date().toISOString(),
      impactData,
      metrics: {
        magnitude: mag,
        depthKm: depth,
        populationExposed: impactData?.exposureMetrics?.populationExposed ?? null,
        hospitalsCount: impactData?.exposureMetrics?.hospitalsCount || 0,
        airportsCount: impactData?.exposureMetrics?.airportsCount || 0,
      },
      rawIncident: inc,
    };
  }

  static enrichSeededCrisis(seeded) {
    const lat = seeded.location.lat;
    const lon = seeded.location.lon;
    const mag = seeded.magnitude || 6.0;
    const depth = seeded.location.depthKm || 10;

    const impactData = EarthquakeImpactEngine.evaluate({
      magnitude: mag,
      depthKm: depth,
      lat,
      lon,
      place: seeded.location.name,
    });

    return {
      ...seeded,
      impactData,
      sourceMode: SourceMode.SIMULATED,
      dataState: DataState.SYNTHETIC,
      metrics: {
        magnitude: mag,
        depthKm: depth,
        populationExposed: impactData.exposureMetrics?.populationExposed ?? null,
        hospitalsCount: impactData.exposureMetrics?.hospitalsCount || 0,
        airportsCount: impactData.exposureMetrics?.airportsCount || 0,
      },
    };
  }
}
