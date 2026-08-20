/**
 * Worldview Disaster Intelligence — Correlation Rules & Heuristics
 *
 * Configurable hazard-specific correlation parameters.
 *
 * Adheres to Phase 6C Correction #1:
 *   - "Correlation radii and temporal windows are configurable hazard-specific heuristics,
 *      not universal truths. Every correlation rule must document its rationale/source."
 */

export const CORRELATION_RULES = Object.freeze({
  EARTHQUAKE: {
    hazardType: 'EARTHQUAKE',
    spatialRadiusKm: 100.0,
    temporalWindowMinutes: 30.0,
    magnitudeDeltaConflictThreshold: 0.3,
    rationale:
      'USGS / GDACS teleseismic epicentral uncertainty is typically within 50-100km; mainshocks register across networks within minutes. Magnitude delta > 0.3 indicates calibration disagreement.',
    matchingTypes: ['EARTHQUAKE', 'SEISMIC_STATION_READING', 'TSUNAMI_SIGNAL', 'OFFICIAL_WARNING'],
  },

  WILDFIRE: {
    hazardType: 'WILDFIRE',
    spatialRadiusKm: 25.0,
    temporalWindowMinutes: 720.0, // 12 hours
    rationale:
      'VIIRS/MODIS active fire pixels within 25km represent a continuous or advancing wildfire complex across satellite orbital overpass intervals (approx 6-12 hours).',
    matchingTypes: ['WILDFIRE_HOTSPOT', 'WEATHER'],
  },

  FLOOD: {
    hazardType: 'FLOOD',
    spatialRadiusKm: 35.0,
    temporalWindowMinutes: 1440.0, // 24 hours
    rationale:
      'Meso-beta scale convective precipitation cells and micro-watershed runoff basins typically correlate within 35km radius over 24h antecedent rainfall accumulation.',
    matchingTypes: ['FLOOD_SIGNAL', 'WEATHER', 'RAINFALL', 'WATER_LEVEL_OBSERVATION', 'OFFICIAL_WARNING'],
  },

  CYCLONE: {
    hazardType: 'CYCLONE',
    spatialRadiusKm: 350.0,
    temporalWindowMinutes: 2880.0, // 48 hours
    rationale:
      'Tropical cyclonic outer storm circulation and destructive wind radii span 200-500km; tracking bulletins track multi-day cyclogenesis over 48h windows.',
    matchingTypes: ['CYCLONE', 'HAZARD_TRACK', 'WEATHER', 'OFFICIAL_WARNING'],
  },

  GENERIC: {
    hazardType: 'GENERIC',
    spatialRadiusKm: 20.0,
    temporalWindowMinutes: 180.0, // 3 hours
    rationale: 'Default conservative spatial and temporal envelope for unclassified observations.',
    matchingTypes: ['GENERIC_OBSERVATION'],
  },
});
