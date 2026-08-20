/**
 * Worldview Disaster Intelligence — Secondary Risk Cascade Engine
 *
 * Deterministically evaluates secondary hazards and cascade threats.
 *
 * Adheres to Phase 6C Corrections #5 & #6:
 *   - Omori-Utsu is used to qualitatively characterize aftershock activity decay sequences;
 *     does NOT expose unsupported pseudo-exact probabilities or magnitude forecasts.
 *   - Storm surge is evaluated as "POTENTIAL STORM-SURGE EXPOSURE" with qualitative levels;
 *     does NOT claim unvalidated hydrodynamic surge heights.
 *   - Uses standardized qualitative levels: LOW, MODERATE, ELEVATED, HIGH, UNKNOWN.
 */

import { SecondaryRiskLevel } from '../../event/types.js';

export class SecondaryRiskEngine {
  /**
   * Evaluates secondary cascade risks for a hazard candidate.
   *
   * @param {object} params
   * @param {string} params.hazardType - 'EARTHQUAKE' | 'FLOOD' | 'WILDFIRE' | 'CYCLONE'
   * @param {object} params.metrics - Observed telemetry metrics
   * @param {object} [params.exposure={}] - Exposure engine results (population, terrain, infra)
   * @returns {object} Structured secondary risk assessment
   */
  static evaluate({ hazardType, metrics = {}, exposure = {} }) {
    switch (hazardType.toUpperCase()) {
      case 'EARTHQUAKE':
        return this._evaluateEarthquakeCascades(metrics, exposure);
      case 'FLOOD':
        return this._evaluateFloodCascades(metrics, exposure);
      case 'WILDFIRE':
        return this._evaluateWildfireCascades(metrics, exposure);
      case 'CYCLONE':
        return this._evaluateCycloneCascades(metrics, exposure);
      default:
        return {
          overallRiskLevel: SecondaryRiskLevel.LOW,
          details: {},
        };
    }
  }

  static _evaluateEarthquakeCascades(metrics, exposure) {
    const mag = metrics.magnitude || 5.0;
    const depth = metrics.depthKm !== undefined ? metrics.depthKm : 10;
    const tsunamiFlag = Boolean(metrics.tsunamiFlag);
    const slope = exposure.terrain?.derived?.slopeDegrees || 0;

    // 1. Aftershock Sequence Characterization (Omori-Utsu Empirical Decay Characterization)
    let aftershockLevel = SecondaryRiskLevel.LOW;
    let aftershockNote = 'Minor aftershock decay sequence anticipated.';

    if (mag >= 7.5) {
      aftershockLevel = SecondaryRiskLevel.HIGH;
      aftershockNote =
        'Energetic Omori-Utsu aftershock decay sequence expected over several weeks. Strongest aftershocks may approach M6.5+ (empirical Båth law).';
    } else if (mag >= 6.5) {
      aftershockLevel = SecondaryRiskLevel.ELEVATED;
      aftershockNote =
        'Active aftershock sequence expected over 7–14 days in the rupture zone; heightened alertness recommended for structurally damaged buildings.';
    } else if (mag >= 5.5) {
      aftershockLevel = SecondaryRiskLevel.MODERATE;
      aftershockNote = 'Moderate aftershock cluster anticipated in local epicentral zone.';
    }

    // 2. Potential Tsunami Hazard Assessment (Qualitative / Empirical)
    let tsunamiLevel = SecondaryRiskLevel.LOW;
    let tsunamiNote = 'Deep or inland epicenter; negligible tsunami hazard.';

    if (depth <= 70) {
      if (mag >= 7.5 || tsunamiFlag) {
        tsunamiLevel = SecondaryRiskLevel.HIGH;
        tsunamiNote =
          'POTENTIAL TSUNAMI HAZARD: Major shallow subsea/coastal rupture. Requires verification and official advisory from National/Regional Tsunami Warning Center (PTWC / ITEWC / InaTEWS).';
      } else if (mag >= 7.0) {
        tsunamiLevel = SecondaryRiskLevel.ELEVATED;
        tsunamiNote =
          'POTENTIAL TSUNAMI HAZARD: Strong shallow marine seismic event. Localized coastal wave disturbances possible.';
      } else if (mag >= 6.5) {
        tsunamiLevel = SecondaryRiskLevel.MODERATE;
        tsunamiNote = 'Minor marine perturbation potential; monitoring sea-level gauges.';
      }
    }

    // 3. Coseismic Landslide Susceptibility (DEM Topographic Slope)
    let landslideLevel = SecondaryRiskLevel.LOW;
    let landslideNote = 'Nominal terrain slope in epicentral zone.';

    if (slope >= 25 && mag >= 6.0) {
      landslideLevel = SecondaryRiskLevel.HIGH;
      landslideNote = `High coseismic landslide and rockfall susceptibility on steep mountain terrain (${slope.toFixed(1)}° DEM slope gradient).`;
    } else if (slope >= 15 && mag >= 5.5) {
      landslideLevel = SecondaryRiskLevel.ELEVATED;
      landslideNote = `Elevated slope instability and localized slope failures possible (${slope.toFixed(1)}° DEM slope gradient).`;
    } else if (slope >= 10 && mag >= 6.5) {
      landslideLevel = SecondaryRiskLevel.MODERATE;
      landslideNote = 'Moderate slope failure risk on undulating terrain.';
    }

    return {
      aftershocks: { level: aftershockLevel, note: aftershockNote },
      tsunami: { level: tsunamiLevel, note: tsunamiNote },
      landslides: { level: landslideLevel, note: landslideNote },
    };
  }

  static _evaluateFloodCascades(metrics, exposure) {
    const rainfall24h = metrics.rainfallMm || metrics.precipitation24h || 0;
    const isExtremeRain = rainfall24h >= 115.6; // IMD Very Heavy+
    const slope = exposure.terrain?.derived?.slopeDegrees || 5;

    let isolationLevel = SecondaryRiskLevel.LOW;
    let isolationNote = 'Nominal road and arterial access.';

    if (isExtremeRain && slope <= 3) {
      isolationLevel = SecondaryRiskLevel.HIGH;
      isolationNote = 'High risk of arterial road submergence and community isolation in flat low-lying drainage basin.';
    } else if (rainfall24h >= 64.5) {
      isolationLevel = SecondaryRiskLevel.ELEVATED;
      isolationNote = 'Localized urban waterlogging and underpass submergence likely.';
    }

    let drainageCongestion = {
      level: isExtremeRain ? SecondaryRiskLevel.HIGH : SecondaryRiskLevel.MODERATE,
      note: 'Catchment inflow exceeds stormwater discharge capacity.',
    };

    return {
      roadIsolation: { level: isolationLevel, note: isolationNote },
      drainageCongestion,
    };
  }

  static _evaluateWildfireCascades(metrics, _exposure) {
    const windMps = metrics.windSpeedMps || 0;
    const frp = metrics.frpMW || 20;

    let spreadLevel = SecondaryRiskLevel.LOW;
    let spreadNote = 'Ambient surface wind nominal; moderate fire perimeter expansion.';

    if (windMps >= 14.0 || (windMps >= 10.0 && frp >= 80)) {
      spreadLevel = SecondaryRiskLevel.HIGH;
      spreadNote = `High wind velocity (${windMps.toFixed(1)} m/s) and intense thermal release accelerate rapid fire spread and ember spotting.`;
    } else if (windMps >= 8.0) {
      spreadLevel = SecondaryRiskLevel.ELEVATED;
      spreadNote = `Moderate wind (${windMps.toFixed(1)} m/s) driving directional fire perimeter advance.`;
    }

    let smokePlume = {
      level: frp >= 100 ? SecondaryRiskLevel.HIGH : SecondaryRiskLevel.MODERATE,
      note: 'Dense particulate smoke plume dispersion towards downwind populated sectors.',
    };

    return {
      spreadPotential: { level: spreadLevel, note: spreadNote },
      smokeExposure: smokePlume,
    };
  }

  static _evaluateCycloneCascades(metrics, _exposure) {
    const windMps = metrics.maxSustainedWindMps || 25;
    const pressureHpa = metrics.centralPressureHpa || 990;

    // POTENTIAL STORM-SURGE EXPOSURE (Correction #6: Qualitative assessment)
    let surgeLevel = SecondaryRiskLevel.LOW;
    let surgeNote = 'Moderate barometric depression; localized coastal wave action.';

    if (pressureHpa <= 960 || windMps >= 45) {
      surgeLevel = SecondaryRiskLevel.HIGH;
      surgeNote =
        'POTENTIAL STORM-SURGE EXPOSURE: Very intense low-pressure system and destructive storm-force winds. High coastal inundation risk along landfall sector (Qualitative synoptic estimate; detailed hydrodynamic modeling required for precise surge height).';
    } else if (pressureHpa <= 980 || windMps >= 33) {
      surgeLevel = SecondaryRiskLevel.ELEVATED;
      surgeNote =
        'POTENTIAL STORM-SURGE EXPOSURE: Elevated storm tide and coastal wave battering expected near landfall.';
    }

    let squallWind = {
      level: windMps >= 35 ? SecondaryRiskLevel.HIGH : SecondaryRiskLevel.MODERATE,
      note: `Destructive gale/cyclonic wind gusts (${windMps.toFixed(1)} m/s) capable of uprooting trees and damaging lightweight structures.`,
    };

    return {
      stormSurge: { level: surgeLevel, note: surgeNote },
      extremeWind: squallWind,
    };
  }
}
