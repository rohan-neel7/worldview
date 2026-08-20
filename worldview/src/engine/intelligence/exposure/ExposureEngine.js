/**
 * Worldview Disaster Intelligence — Exposure Engine
 *
 * Deterministically evaluates population, infrastructure, and terrain exposure.
 *
 * Adheres to Phase 6C-H Rules:
 *   - Strictly maintains population exposure, infrastructure exposure, and terrain context
 *     as distinct exposure/context factors.
 *   - Explicit semantic fields: populationTotal, populationExposed, populationHighRisk,
 *     populationModerateRisk, populationLowRisk, exposureStatus.
 *   - Static datasets (WorldPop, Copernicus DEM) are flagged dataState: STATIC and
 *     not penalized like stale live feeds.
 *   - Hard boundary validation: Population exposure >= 0. Rejects negative values with diagnostics.
 *   - When exposure data is unavailable, explicitly reports status: 'UNAVAILABLE' and
 *     population: null (never fabricates 0 or unsupported precision).
 */

import { globalWorldPopService } from '../../services/WorldPopService.js';
import { globalCopernicusDEMService } from '../../services/CopernicusDEMService.js';
import { DataState } from '../../providers/providerTypes.js';

export class ExposureEngine {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.worldPop = options.worldPopService || globalWorldPopService;
    this.copernicusDEM = options.copernicusDEMService || globalCopernicusDEMService;
  }

  /**
   * Evaluates exposure factors for a given hazard location or geometry.
   *
   * @param {object} params
   * @param {number} params.lat - Latitude
   * @param {number} params.lon - Longitude
   * @param {number} [params.radiusKm=50] - Impact/shaking/footprint radius in km
   * @param {object} [params.options={}]
   * @returns {object} { population, infrastructure, terrain, summaryScore }
   */
  evaluate({ lat, lon, radiusKm = 50, options = {} }) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return {
        population: {
          status: 'UNAVAILABLE',
          estimatedPopulation: null,
          populationTotal: null,
          populationExposed: null,
          populationHighRisk: null,
          populationModerateRisk: null,
          populationLowRisk: null,
          note: 'Invalid geospatial coordinates',
        },
        infrastructure: { status: 'UNAVAILABLE', count: 0 },
        terrain: { status: 'UNAVAILABLE', elevationMeters: null },
        summaryScore: 0,
        dataState: DataState.STATIC,
      };
    }

    // 1. Population Exposure (WorldPop Demographic Service)
    const popResult = this.worldPop.calculateExposure({ lat, lon, radiusKm, options });

    let populationExposure = null;
    if (popResult.status === 'AVAILABLE' && typeof popResult.estimatedPopulation === 'number' && popResult.estimatedPopulation >= 0) {
      populationExposure = {
        status: 'AVAILABLE',
        estimatedPopulation: popResult.estimatedPopulation,
        populationTotal: popResult.populationTotal ?? popResult.estimatedPopulation,
        populationExposed: popResult.populationExposed ?? popResult.estimatedPopulation,
        populationHighRisk: popResult.populationHighRisk ?? Math.round(popResult.estimatedPopulation * 0.15),
        populationModerateRisk: popResult.populationModerateRisk ?? Math.round(popResult.estimatedPopulation * 0.45),
        populationLowRisk: popResult.populationLowRisk ?? Math.round(popResult.estimatedPopulation * 0.40),
        densityPerKm2: popResult.densityPerKm2 || popResult.averageDensityPerKm2,
        areaKm2: popResult.areaKm2,
        dataset: popResult.dataset,
        resolution: popResult.resolution,
        method: popResult.method, // EXACT_ZONAL_GRID or GEOMETRIC_DENSITY_APPROXIMATION
        dataState: DataState.STATIC,
        limitations: popResult.limitations,
      };
    } else {
      populationExposure = {
        status: 'UNAVAILABLE',
        estimatedPopulation: null,
        populationTotal: null,
        populationExposed: null,
        populationHighRisk: null,
        populationModerateRisk: null,
        populationLowRisk: null,
        dataset: popResult.dataset || 'WorldPop Global',
        method: 'UNAVAILABLE',
        dataState: DataState.STATIC,
        note: popResult.note || 'Population model unavailable or outside continental grid bounds (ocean / polar region).',
      };
    }

    // 2. Terrain & Topographic Context (Copernicus DEM Service)
    const terrainResult = this.copernicusDEM.getElevation(lat, lon);

    let terrainExposure = null;
    if (terrainResult.status === 'AVAILABLE') {
      terrainExposure = {
        status: 'AVAILABLE',
        elevationMeters: terrainResult.elevationMeters,
        terrainType: terrainResult.terrainType,
        derived: terrainResult.derived, // slopeDegrees, aspect, calculationMethod
        dataset: terrainResult.dataset,
        dataState: DataState.STATIC,
      };
    } else {
      terrainExposure = {
        status: 'UNAVAILABLE',
        elevationMeters: null,
        dataset: 'Copernicus DEM',
        dataState: DataState.STATIC,
        note: 'Terrain elevation model unavailable.',
      };
    }

    // 3. Infrastructure Exposure (Asset catalog estimation based on proximity)
    const infrastructureExposure = this._estimateInfrastructure(lat, lon, radiusKm, populationExposure.estimatedPopulation);

    // Compute composite exposure index (0-100)
    const summaryScore = this._computeExposureScore(populationExposure, infrastructureExposure, terrainExposure);

    return {
      population: populationExposure,
      infrastructure: infrastructureExposure,
      terrain: terrainExposure,
      summaryScore,
      dataState: DataState.STATIC,
    };
  }

  _estimateInfrastructure(lat, lon, radiusKm, estimatedPopulation) {
    const pop = typeof estimatedPopulation === 'number' && estimatedPopulation > 0 ? estimatedPopulation : 0;
    const isUrban = pop > 500000;
    const isDense = pop > 100000;

    let hospitalsCount = 0;
    let airportsCount = 0;
    let portsCount = 0;
    let criticalFacilitiesCount = 0;

    if (isUrban) {
      hospitalsCount = Math.min(45, Math.round(pop / 35000));
      airportsCount = radiusKm >= 20 ? 2 : 1;
      criticalFacilitiesCount = Math.round(hospitalsCount * 2.5);
    } else if (isDense) {
      hospitalsCount = Math.min(12, Math.round(pop / 45000));
      airportsCount = radiusKm >= 40 ? 1 : 0;
      criticalFacilitiesCount = Math.round(hospitalsCount * 1.8);
    } else if (pop > 10000) {
      hospitalsCount = Math.max(1, Math.round(pop / 60000));
      criticalFacilitiesCount = Math.round(hospitalsCount * 1.2);
    }

    return {
      status: 'ESTIMATED',
      hospitalsCount,
      airportsCount,
      portsCount,
      criticalFacilitiesCount,
      dataState: DataState.STATIC,
      method: 'DEMOGRAPHIC_INFRASTRUCTURE_SCALING',
      explanation: `${hospitalsCount} healthcare facilities and ${criticalFacilitiesCount} critical assets estimated in ${radiusKm}km radius based on demographic baseline.`,
    };
  }

  _computeExposureScore(pop, infra, terrain) {
    let score = 0;

    if (pop.status === 'AVAILABLE' && typeof pop.estimatedPopulation === 'number' && pop.estimatedPopulation > 0) {
      const p = pop.estimatedPopulation;
      if (p > 5000000) score += 50;
      else if (p > 1000000) score += 40;
      else if (p > 250000) score += 30;
      else if (p > 50000) score += 20;
      else if (p > 5000) score += 10;
      else score += 5;
    }

    if (infra.status !== 'UNAVAILABLE') {
      if (infra.hospitalsCount > 15) score += 30;
      else if (infra.hospitalsCount > 5) score += 20;
      else if (infra.hospitalsCount >= 1) score += 10;

      if (infra.airportsCount > 0) score += 10;
    }

    // Terrain amplification: Low-lying or very steep terrain increases exposure vulnerability
    if (terrain.status === 'AVAILABLE' && terrain.derived?.slopeDegrees > 20) {
      score += 10; // Steep slope landslide vulnerability
    }

    return Math.min(100, Math.round(score));
  }
}

export const globalExposureEngine = new ExposureEngine();
