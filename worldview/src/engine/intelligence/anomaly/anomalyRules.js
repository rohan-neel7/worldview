/**
 * Worldview Disaster Intelligence — Anomaly Detection Rules & Baseline Thresholds
 *
 * Adheres to Phase 6C Corrections #2 & #3:
 *   - "Do not use 3-sigma anomaly detection unless an adequate historical baseline exists.
 *      Otherwise use provider-defined thresholds, climatological baselines, forecast
 *      deviation, or explicitly labelled heuristic thresholds."
 *   - "Rainfall thresholds are not universal. Make them region/provider/hazard configurable
 *      and document their source."
 */

export const ANOMALY_THRESHOLDS = Object.freeze({
  // IMD Official Classification (Source: IMD Meteorological Glossary, MoES India)
  IMD_RAINFALL_24H: {
    HEAVY: 64.5,
    VERY_HEAVY: 115.6,
    EXTREMELY_HEAVY: 204.4,
    source: 'India Meteorological Department (IMD) Standard 24h Precipitation Categories',
  },

  // IMD Hourly Nowcast / Cloudburst Threshold (Source: IMD Nowcast Guidance)
  IMD_RAINFALL_1H: {
    INTENSE: 30.0,
    VERY_INTENSE: 50.0,
    CLOUDBURST: 100.0,
    source: 'IMD Severe Weather Nowcast Guidelines',
  },

  // Global Heuristic Rainfall Baseline (Source: WMO Extreme Precipitation Guidance)
  GLOBAL_RAINFALL_24H: {
    HEAVY: 50.0,
    VERY_HEAVY: 100.0,
    EXTREMELY_HEAVY: 150.0,
    source: 'WMO Guidelines on Extreme Weather Indices (Heuristic Global Baseline)',
  },

  // NASA FIRMS Thermal Anomaly Thresholds (Source: NASA LANCE / FIRMS MODIS & VIIRS Product Guide)
  NASA_FIRMS_THERMAL: {
    MODERATE_FRP_MW: 20.0,
    HIGH_FRP_MW: 50.0,
    EXTREME_FRP_MW: 150.0,
    HIGH_BRIGHTNESS_K: 335.0,
    source: 'NASA LANCE / FIRMS Fire Radiative Power (MW) & Brightness Temp Thresholds',
  },

  // High Surface Wind (Source: World Meteorological Organization Beaufort Scale)
  SURFACE_WIND_MPS: {
    GALE: 14.0,       // ~50 km/h
    STORM: 20.0,      // ~72 km/h
    VIOLENT_STORM: 28.0, // ~100 km/h
    source: 'WMO Beaufort Scale Technical Regulations',
  },

  // Barometric Pressure Drop (Source: AMS Severe Weather Telemetry)
  PRESSURE_DROP_HPA: {
    RAPID_DROP_3H: 6.0,
    EXTREME_DROP_3H: 12.0,
    source: 'Standard Marine / Synoptic Barometric Tendency Guidance',
  },
});
