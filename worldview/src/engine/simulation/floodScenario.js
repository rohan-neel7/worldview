import { EventType, EventCategory, SourceMode } from '../event/types.js';

/**
 * Deterministic Bengaluru Urban Flood Scenario.
 *
 * All frames are explicitly labeled as SIMULATED.
 */
export const BENGALURU_FLOOD_SCENARIO = {
  scenarioId: 'sim-blr-flood-2026',
  name: 'Bengaluru Urban Basin Cloudburst & Runoff Scenario',
  description: 'Deterministic 3-stage simulated flash-flood progression across Bellandur/Varthur catchment basin.',
  location: {
    lat: 12.9352,
    lon: 77.6784,
    name: 'Bengaluru East (Bellandur-Varthur Basin)',
  },

  frames: [
    // Frame 1: Extreme rainfall anomaly
    {
      frameIndex: 0,
      timestampOffsetSeconds: 0,
      label: 'SIMULATED RAINFALL ANOMALY',
      rawEvents: [
        {
          id: 'sim-meteo-blr-001',
          source: 'SIMULATION_ENGINE',
          sourceMode: SourceMode.SIMULATED,
          type: EventType.WEATHER,
          category: EventCategory.ENVIRONMENTAL,
          location: { lat: 12.9352, lon: 77.6784, altMeters: 920 },
          confidence: 0.96,
          label: 'SIMULATED INTENSE RAINFALL',
          payload: {
            precipitationMm: 135.0,
            precipitationRateMmH: 45.0,
            temperatureC: 22.0,
            windSpeedMps: 14.5,
            place: 'Bellandur Basin, Bengaluru',
            simulatedDescription: 'Simulated 135mm/3h extreme cloudburst',
          },
        },
      ],
    },

    // Frame 2: Corroborating Lake/River catchment gauge overflow
    {
      frameIndex: 1,
      timestampOffsetSeconds: 15,
      label: 'SIMULATED WATER LEVEL SURGE',
      rawEvents: [
        {
          id: 'sim-gauge-blr-002',
          source: 'SIMULATION_ENGINE',
          sourceMode: SourceMode.SIMULATED,
          type: EventType.WATER_LEVEL_OBSERVATION,
          category: EventCategory.OBSERVATION,
          location: { lat: 12.9410, lon: 77.6912, altMeters: 905 },
          confidence: 0.92,
          label: 'SIMULATED CATCHMENT GAUGE SURGE',
          payload: {
            waterLevelAnomaly: 2.85,
            riverStageMeters: 3.85,
            thresholdExceeded: true,
            stationId: 'BLR-VARTHUR-01',
            place: 'Varthur Lake Outlet Channel',
            simulatedDescription: 'Simulated channel stage +2.85m exceeding high-flood limit',
          },
        },
      ],
    },

    // Frame 3: Infrastructure arterial impact signal
    {
      frameIndex: 2,
      timestampOffsetSeconds: 30,
      label: 'SIMULATED INFRASTRUCTURE EXPOSURE',
      rawEvents: [
        {
          id: 'sim-infra-blr-003',
          source: 'SIMULATION_ENGINE',
          sourceMode: SourceMode.SIMULATED,
          type: EventType.FLOOD_SIGNAL,
          category: EventCategory.HAZARD,
          location: { lat: 12.9298, lon: 77.6845, altMeters: 910 },
          confidence: 0.88,
          label: 'SIMULATED ARTERIAL CORRIDOR INUNDATION',
          payload: {
            floodDepthMeters: 0.65,
            corridorName: 'Outer Ring Road (ORR) Bellandur Stretch',
            exposureScore: 85,
            drainageCapacityPct: 15,
            place: 'Outer Ring Road, Bengaluru',
            simulatedDescription: 'Simulated urban arterial runoff inundation',
          },
        },
      ],
    },
  ],
};
