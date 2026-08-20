import { SeverityLevel } from '../event/types.js';
import { scoreToSeverity as centralizedScoreToSeverity, SEVERITY_THRESHOLDS, getSeverityFromScore, getSeverityMetadata } from './severityPolicy.js';

export { SEVERITY_THRESHOLDS, getSeverityFromScore, getSeverityMetadata };

/**
 * Normalizes a raw continuous value to a 0-100 score given min/max thresholds.
 */
export function normalizeScore(value, minVal, maxVal) {
  if (value === null || value === undefined || isNaN(value)) return null;
  if (minVal >= maxVal) return 50;
  const clamped = Math.max(minVal, Math.min(maxVal, value));
  return Math.round(((clamped - minVal) / (maxVal - minVal)) * 100);
}

/**
 * Maps a 0-100 numerical risk score to a SeverityLevel enum via centralized policy.
 */
export function scoreToSeverity(score) {
  return centralizedScoreToSeverity(score);
}

/**
 * Hazard-Specific Factor Evaluators
 */
export const HAZARD_MODELS = {
  EARTHQUAKE: {
    name: 'Earthquake Risk Model',
    factors: [
      {
        name: 'Seismic Intensity & Focal Depth',
        weight: 0.35,
        evaluate: (metrics) => {
          const mag = metrics.magnitude || 4.5;
          const depth = metrics.depthKm || 10;
          const magScore = normalizeScore(mag, 4.0, 8.5);
          const depthMultiplier = depth < 30 ? 1.0 : (depth < 70 ? 0.75 : (depth < 150 ? 0.5 : 0.3));
          const score = Math.round(magScore * depthMultiplier);
          return {
            score: Math.min(100, Math.max(0, score)),
            raw: `M${mag} @ ${depth}km`,
            note: `M${mag} event with focal depth of ${depth}km (${depth < 30 ? 'shallow crustal' : depth < 70 ? 'intermediate' : 'deep subduction'})`,
          };
        },
      },
      {
        name: 'Population Exposure Density',
        weight: 0.25,
        evaluate: (metrics) => {
          const pop = metrics.populationExposed !== undefined ? metrics.populationExposed : 10000;
          let score = 20;
          if (pop >= 1000000) score = 95;
          else if (pop >= 500000) score = 85;
          else if (pop >= 100000) score = 70;
          else if (pop >= 20000) score = 50;
          else if (pop >= 5000) score = 35;
          return {
            score,
            raw: pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M exposed` : `${Math.round(pop / 1000)}k exposed`,
            note: `Estimated ${pop.toLocaleString()} people inside perceptible/severe shaking isoseismals`,
          };
        },
      },
      {
        name: 'Critical Infrastructure Exposure',
        weight: 0.20,
        evaluate: (metrics) => {
          const exp = metrics.exposureScore !== undefined ? metrics.exposureScore : 40;
          const hospCount = metrics.hospitalsCount || 0;
          const aptCount = metrics.airportsCount || 0;
          const roadCount = metrics.roadsCount || 0;
          const score = Math.min(100, Math.max(0, exp));
          return {
            score,
            raw: `${hospCount} hosp / ${aptCount} apt / ${roadCount} rds`,
            note: `${hospCount} hospital(s), ${aptCount} airport(s), and ${roadCount} transit corridor(s) in estimated impact zone`,
          };
        },
      },
      {
        name: 'Secondary Hazard Potential',
        weight: 0.10,
        evaluate: (metrics) => {
          let score = 25;
          let note = 'Nominal secondary hazard indicators';
          const mag = metrics.magnitude || 4.5;
          const depth = metrics.depthKm || 10;
          const tsunamiFlag = Boolean(metrics.tsunamiFlag);

          if (tsunamiFlag || (mag >= 6.5 && depth <= 70 && metrics.coastalExposure)) {
            score = 85;
            note = 'Potential coastal tsunami / littoral surge hazard';
          } else if (mag >= 6.5) {
            score = 65;
            note = 'Elevated aftershock decay & slope instability hazard';
          } else if (mag >= 5.5) {
            score = 45;
            note = 'Moderate aftershock probability';
          }

          return {
            score,
            raw: score >= 80 ? 'HIGH_SECONDARY' : (score >= 50 ? 'ELEVATED' : 'LOW'),
            note,
          };
        },
      },
      {
        name: 'Coping & Response Deficit',
        weight: 0.10,
        evaluate: (metrics) => {
          const deficit = metrics.copingDeficit !== undefined ? metrics.copingDeficit : 50;
          return {
            score: Math.min(100, Math.max(0, deficit)),
            raw: `${deficit}% deficit`,
            note: 'Regional emergency response & emergency medical staging capacity',
          };
        },
      },
    ],
  },
  FLOOD: {
    name: 'Flood Risk Model',
    factors: [
      {
        name: 'Precipitation Intensity',
        weight: 0.35,
        evaluate: (metrics) => {
          const mm = metrics.precipitationMm;
          if (mm === undefined || mm === null) return { score: 40, raw: 'UNKNOWN', note: 'Rainfall data absent; assumed nominal' };
          const s = normalizeScore(mm, 10, 150);
          return { score: s, raw: `${mm}mm`, note: `Observed ${mm}mm accumulated precipitation` };
        },
      },
      {
        name: 'Catchment / Water Level',
        weight: 0.25,
        evaluate: (metrics) => {
          const waterLevel = metrics.waterLevelAnomaly || metrics.riverStageMeters;
          if (waterLevel === undefined || waterLevel === null) {
            return { score: 30, raw: 'UNKNOWN', note: 'No direct river gauge telemetry (evidence gap)' };
          }
          const s = normalizeScore(waterLevel, 1.0, 5.0);
          return { score: s, raw: `${waterLevel}m`, note: `River stage at ${waterLevel}m relative to datum` };
        },
      },
      {
        name: 'Asset & Population Exposure',
        weight: 0.20,
        evaluate: (metrics) => {
          const exp = metrics.exposureScore !== undefined ? metrics.exposureScore : 65; // Default urban baseline
          const s = Math.min(100, Math.max(0, exp));
          return { score: s, raw: `${s}/100`, note: 'Urban infrastructure & arterial transit corridor exposure' };
        },
      },
      {
        name: 'Coping Capacity Deficit',
        weight: 0.20,
        evaluate: (metrics) => {
          const drainageAbsorption = metrics.drainageCapacityPct !== undefined ? metrics.drainageCapacityPct : 30;
          const deficit = Math.min(100, Math.max(0, 100 - drainageAbsorption));
          return { score: deficit, raw: `${deficit}% deficit`, note: `Stormwater drainage capacity estimated at ${drainageAbsorption}%` };
        },
      },
    ],
  },

  TSUNAMI: {
    name: 'Tsunami Risk Model',
    factors: [
      {
        name: 'Seismic Magnitude & Depth',
        weight: 0.40,
        evaluate: (metrics) => {
          const mag = metrics.magnitude || 6.0;
          const depth = metrics.depthKm || 10;
          const magScore = normalizeScore(mag, 6.0, 8.5);
          const depthMultiplier = depth < 30 ? 1.0 : (depth < 70 ? 0.7 : 0.4);
          const finalScore = Math.round(magScore * depthMultiplier);
          return { score: Math.min(100, Math.max(0, finalScore)), raw: `M${mag} @ ${depth}km`, note: `M${mag} shallow oceanic epicenter (${depth}km depth)` };
        },
      },
      {
        name: 'Coastal Exposure',
        weight: 0.25,
        evaluate: (metrics) => {
          const exp = metrics.coastalProximityScore !== undefined ? metrics.coastalProximityScore : 75;
          const s = Math.min(100, Math.max(0, exp));
          return { score: s, raw: `${s}/100`, note: 'Coastal littoral settlements in direct propagation path' };
        },
      },
      {
        name: 'Warning Verification',
        weight: 0.20,
        evaluate: (metrics) => {
          const hasFlag = Boolean(metrics.tsunamiFlag);
          const score = hasFlag ? 85 : 40;
          return { score, raw: hasFlag ? 'FLAG_ACTIVE' : 'UNCONFIRMED', note: hasFlag ? 'Automated advisory flag broadcast' : 'Awaiting deep-ocean DART buoy confirmation' };
        },
      },
      {
        name: 'Coping Capacity Deficit',
        weight: 0.15,
        evaluate: () => {
          return { score: 60, raw: '60/100', note: 'Standard coastal evacuation lead time constraints' };
        },
      },
    ],
  },

  WILDFIRE: {
    name: 'Wildfire Risk Model',
    factors: [
      {
        name: 'Thermal Hotspot Intensity',
        weight: 0.35,
        evaluate: (metrics) => {
          const frp = metrics.frp || (metrics.brightnessTempK ? (metrics.brightnessTempK - 300) : 40);
          const s = normalizeScore(frp, 10, 200);
          return { score: s, raw: `${frp}MW`, note: `Radiative fire power intensity at ${frp}MW` };
        },
      },
      {
        name: 'Surface Wind Acceleration',
        weight: 0.25,
        evaluate: (metrics) => {
          const windMps = metrics.windSpeedMps || 0;
          const s = normalizeScore(windMps, 3.0, 25.0);
          return { score: s, raw: `${windMps}m/s`, note: `Wind speed measured at ${windMps}m/s` };
        },
      },
      {
        name: 'Vegetation & Perimeter Exposure',
        weight: 0.20,
        evaluate: (metrics) => {
          const exp = metrics.exposureScore !== undefined ? metrics.exposureScore : 60;
          const s = Math.min(100, Math.max(0, exp));
          return { score: s, raw: `${s}/100`, note: 'Interface between woodland and populated assets' };
        },
      },
      {
        name: 'Coping Capacity Deficit',
        weight: 0.20,
        evaluate: () => {
          return { score: 50, raw: '50/100', note: 'Initial attack suppression resources deployed' };
        },
      },
    ],
  },

  GENERIC: {
    name: 'Standard Hazard Risk Model',
    factors: [
      {
        name: 'Hazard Signal Magnitude',
        weight: 0.40,
        evaluate: (metrics) => {
          const val = metrics.magnitude !== undefined ? metrics.magnitude : (metrics.intensity !== undefined ? metrics.intensity : 50);
          const s = typeof val === 'number' && val <= 10 && val >= 0 ? normalizeScore(val, 3.0, 8.0) : Math.min(100, Math.max(0, val));
          return { score: s, raw: `${val}`, note: 'Primary physical hazard observation signal' };
        },
      },
      {
        name: 'Asset Exposure',
        weight: 0.30,
        evaluate: (metrics) => {
          const exp = metrics.exposureScore !== undefined ? metrics.exposureScore : 50;
          const s = Math.min(100, Math.max(0, exp));
          return { score: s, raw: `${s}/100`, note: 'Estimated regional infrastructure density' };
        },
      },
      {
        name: 'Coping Capacity Deficit',
        weight: 0.30,
        evaluate: (metrics) => {
          const def = metrics.copingDeficit !== undefined ? metrics.copingDeficit : 50;
          const s = Math.min(100, Math.max(0, def));
          return { score: s, raw: `${s}/100`, note: 'Standard municipal emergency response baseline' };
        },
      },
    ],
  },
};
