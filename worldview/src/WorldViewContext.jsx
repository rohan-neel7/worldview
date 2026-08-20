import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { EarthquakeImpactEngine } from './engine/impact/EarthquakeImpactEngine.js';
import { globalProviderManager, WorkloadCategory } from './engine/lifecycle/ProviderManager.js';
import { globalCameraController } from './engine/camera/CentralizedCameraController.js';
import { CrisisDiscoveryEngine } from './engine/discovery/CrisisDiscoveryEngine.js';
import { COUNTRIES, getCountryById } from './data/countries.js';

const WorldViewContext = createContext(null);

const DEFAULT_LAYERS = {
  flights: true,
  militaryFlights: false,
  earthquakes: true,
  satellites: true,
  ships: true,
  weather: false,
  impactZones: true,
  exposedAssets: true,
  crisisCircles: true,
};

const LAYER_META = {
  flights: { label: 'Live Flights', source: 'ADSB', interval: '10s' },
  militaryFlights: { label: 'Military Flights', source: 'ADSB', interval: '30s' },
  earthquakes: { label: 'Earthquakes 24h', source: 'USGS', interval: '5min' },
  satellites: { label: 'Satellites', source: 'CelesTrak', interval: '30s' },
  ships: { label: 'Ships (AIS)', source: 'AISstream', interval: 'live' },
  weather: { label: 'Weather Radar', source: 'NOAA', interval: '5min' },
  impactZones: { label: 'Impact Zones', source: 'Seismo-Engine', interval: 'live' },
  exposedAssets: { label: 'Exposed Assets', source: 'OSM / UN Data', interval: 'static' },
  crisisCircles: { label: 'Crisis Circles', source: 'WorldView Fusion', interval: 'live' },
};

export const REGIONS = {
  GLOBAL: { name: 'Global', lat: 20, lon: 20, dist: 9999 },
  AMERICAS: { name: 'Americas', lat: 35, lon: -95, dist: 4000 },
  EUROPE: { name: 'Europe', lat: 51, lon: 15, dist: 2500 },
  ASIA_PACIFIC: { name: 'Asia-Pacific', lat: 25, lon: 110, dist: 4000 },
  MIDDLE_EAST: { name: 'Middle East', lat: 25, lon: 45, dist: 2500 },
  AFRICA: { name: 'Africa', lat: 0, lon: 20, dist: 3500 },
};

const PRESETS = ['NORMAL', 'CRT', 'NVG', 'FLIR', 'NOIR', 'SNOW'];

export function WorldViewProvider({ children }) {
  // ═════════════════════════════════════════════════════════════════
  // 1. PRIMARY OPERATING MODE ARCHITECTURE: WORLD ⟷ CRISIS
  // ═════════════════════════════════════════════════════════════════
  const [activeMode, setActiveModeState] = useState('WORLD'); // 'WORLD' | 'CRISIS'

  const setActiveMode = useCallback((nextMode) => {
    if (nextMode !== 'WORLD' && nextMode !== 'CRISIS') return;
    setActiveModeState(nextMode);
    globalProviderManager.setMode(nextMode);

    if (nextMode === 'WORLD') {
      globalCameraController.flyToGlobal();
    }
  }, []);

  // ═════════════════════════════════════════════════════════════════
  // 2. CRISIS INTELLIGENCE: COUNTRY THEATER & ACTIVE CRISES
  // ═════════════════════════════════════════════════════════════════
  const [selectedCountryId, setSelectedCountryIdState] = useState('IN');
  const [crisisFilter, setCrisisFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'HIGH' | 'SEISMIC' | 'FLOOD'
  const [selectedCrisisId, setSelectedCrisisId] = useState(null);
  const [aiSummaryMode, setAiSummaryMode] = useState('PUBLIC'); // 'PUBLIC' | 'AUTHORITY'
  const [selectedAsset, setSelectedAsset] = useState(null);

  const selectedCountry = useMemo(() => {
    return getCountryById(selectedCountryId);
  }, [selectedCountryId]);

  const setSelectedCountryId = useCallback((cId) => {
    setSelectedCountryIdState(cId);
    setSelectedCrisisId(null);
    setSelectedAsset(null);
    const country = getCountryById(cId);
    globalCameraController.flyToCountry(country);
  }, []);

  // ═════════════════════════════════════════════════════════════════
  // 3. LAYER TOGGLES & VISUAL PRESETS
  // ═════════════════════════════════════════════════════════════════
  const [activeLayers, setActiveLayers] = useState(DEFAULT_LAYERS);
  const toggleLayer = useCallback((layerId) => {
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  const [activePreset, setActivePreset] = useState('NORMAL');

  // ═════════════════════════════════════════════════════════════════
  // 4. DATA TELEMETRY (COUNTS & STATUS)
  // ═════════════════════════════════════════════════════════════════
  const [flightCount, setFlightCount] = useState(0);
  const [satelliteCount, setSatelliteCount] = useState(0);
  const [earthquakeCount, setEarthquakeCount] = useState(0);
  const [shipCount, setShipCount] = useState(0);

  const [selectedRegion, setSelectedRegion] = useState('GLOBAL');
  const [regionStats, setRegionStats] = useState({ flights: 0, quakes: 0, sats: 0, ships: 0 });

  const [weatherSummary, setWeatherSummary] = useState('NO DATA');
  const [trafficLevel, setTrafficLevel] = useState('UNKNOWN');
  const [geminiOutput, setGeminiOutput] = useState(null);
  const [showHUD, setShowHUD] = useState(true);
  const [layout, setLayout] = useState('Tactical');

  // Camera telemetry state (updated throttled on moveEnd)
  const [cameraPosition, setCameraPosition] = useState({
    lat: 20,
    lon: 20,
    alt: 22000000,
  });

  // Pipeline Metrics & Incidents
  const [incidents, setIncidents] = useState([]);
  const [pipelineMetrics, setPipelineMetrics] = useState({
    totalIngested: 0,
    liveCount: 0,
    simulatedCount: 0,
    activeEventsInStore: 0,
    activeIncidents: 0,
    lastProcessedAt: null,
  });
  const [simulationStatus, setSimulationStatus] = useState({
    active: false,
    completed: false,
    scenarioName: null,
  });

  // ═════════════════════════════════════════════════════════════════
  // 5. CRISIS DISCOVERY & IMPACT EVALUATION
  // ═════════════════════════════════════════════════════════════════
  // Discovered crises for the currently selected country
  const [discoveredCrises, setDiscoveredCrises] = useState([]);

  // Runs discovery whenever selectedCountry, incidents, or live earthquakes change
  const refreshCrisisDiscovery = useCallback((liveQuakes = []) => {
    const res = CrisisDiscoveryEngine.discover(selectedCountry, liveQuakes);
    setDiscoveredCrises(res.activeCrises || []);
  }, [selectedCountry]);

  // Filtered crises based on crisisFilter
  const activeCrises = useMemo(() => {
    if (crisisFilter === 'ALL') return discoveredCrises;
    if (crisisFilter === 'CRITICAL') return discoveredCrises.filter((c) => c.severity === 'CRITICAL');
    if (crisisFilter === 'HIGH') return discoveredCrises.filter((c) => c.severity === 'HIGH');
    if (crisisFilter === 'SEISMIC') return discoveredCrises.filter((c) => c.type === 'EARTHQUAKE');
    if (crisisFilter === 'FLOOD') return discoveredCrises.filter((c) => c.type === 'FLOOD' || c.type === 'CYCLONE');
    return discoveredCrises;
  }, [discoveredCrises, crisisFilter]);

  // Resolves the currently selected crisis object
  const selectedCrisis = useMemo(() => {
    if (!selectedCrisisId || discoveredCrises.length === 0) return null;
    return discoveredCrises.find((c) => c.id === selectedCrisisId) || null;
  }, [selectedCrisisId, discoveredCrises]);

  // Resolves or computes active impact data for selected crisis
  const activeImpactData = useMemo(() => {
    if (selectedCrisis?.impactData) {
      return selectedCrisis.impactData;
    }
    if (selectedCrisis?.location) {
      return EarthquakeImpactEngine.evaluate({
        magnitude: selectedCrisis.magnitude || selectedCrisis.metrics?.magnitude || 5.5,
        depthKm: selectedCrisis.location.depthKm || 10,
        lat: selectedCrisis.location.lat,
        lon: selectedCrisis.location.lon,
        place: selectedCrisis.location.name,
      });
    }
    return null;
  }, [selectedCrisis]);

  // Select a specific crisis and trigger focus
  const selectCrisis = useCallback((crisisOrId) => {
    const cId = typeof crisisOrId === 'string' ? crisisOrId : crisisOrId?.id;
    if (!cId) return;
    setSelectedCrisisId(cId);
    setSelectedAsset(null);
    setActiveModeState('CRISIS');

    const targetCrisis = discoveredCrises.find((c) => c.id === cId);
    if (targetCrisis?.location) {
      globalCameraController.flyToCrisisRadius(targetCrisis);
    }
  }, [discoveredCrises]);

  const clearSelectedCrisis = useCallback(() => {
    setSelectedCrisisId(null);
    setSelectedAsset(null);
    globalCameraController.returnToCountry(selectedCountry);
  }, [selectedCountry]);

  // Legacy mappings for backward compatibility
  const operationalMode = activeMode === 'CRISIS' && selectedCrisisId ? 'INCIDENT' : activeMode;
  const activeIncident = selectedCrisis;
  const enterIncidentMode = selectCrisis;
  const exitIncidentMode = clearSelectedCrisis;

  // ═════════════════════════════════════════════════════════════════
  // 6. LEVEL-2 PURPOSE-SPECIFIC CONTEXTUAL POPOVER STATE (Phase 6D)
  // Strict Invariant (Correction #6): Max ONE popover at a time
  // ═════════════════════════════════════════════════════════════════
  const [activePopover, setActivePopover] = useState(null); // { type: 'DATA_HEALTH' | 'EXPOSURE' | 'RISK_BREAKDOWN' | 'ASSET' | 'EVIDENCE', data: any }
  const openPopover = useCallback((type, data = null) => {
    setActivePopover({ type, data });
  }, []);
  const closePopover = useCallback(() => {
    setActivePopover(null);
  }, []);

  const [activeIncidentTab, setActiveIncidentTab] = useState('OVERVIEW');
  const [showRawTelemetryOnGlobe, setShowRawTelemetryOnGlobe] = useState(false);

  const value = {
    // Mode Management (Phase 4 & 6D)
    activeMode,
    setActiveMode,
    isWorldMode: activeMode === 'WORLD',
    isCrisisMode: activeMode === 'CRISIS',

    // Contextual Popover State (Level 2 Invariant)
    activePopover,
    openPopover,
    closePopover,
    activeIncidentTab,
    setActiveIncidentTab,
    showRawTelemetryOnGlobe,
    setShowRawTelemetryOnGlobe,

    // Country Theater & Crisis Discovery
    COUNTRIES,
    selectedCountryId,
    selectedCountry,
    setSelectedCountryId,
    crisisFilter,
    setCrisisFilter,
    discoveredCrises,
    activeCrises,
    refreshCrisisDiscovery,
    selectedCrisisId,
    selectedCrisis,
    selectCrisis,
    clearSelectedCrisis,
    aiSummaryMode,
    setAiSummaryMode,

    // Layers
    activeLayers,
    toggleLayer,
    LAYER_META,

    // Presets
    activePreset,
    setActivePreset,
    PRESETS,

    // Data counts
    flightCount,
    setFlightCount,
    satelliteCount,
    setSatelliteCount,
    earthquakeCount,
    setEarthquakeCount,
    shipCount,
    setShipCount,

    // Summaries
    weatherSummary,
    setWeatherSummary,
    trafficLevel,
    setTrafficLevel,

    // Gemini
    geminiOutput,
    setGeminiOutput,

    // HUD
    showHUD,
    setShowHUD,
    layout,
    setLayout,

    // Camera
    cameraPosition,
    setCameraPosition,

    // Region
    selectedRegion,
    setSelectedRegion,
    regionStats,
    setRegionStats,
    REGIONS,

    // Pipeline
    incidents,
    setIncidents,
    pipelineMetrics,
    setPipelineMetrics,
    simulationStatus,
    setSimulationStatus,

    // Backward-compatible Incident API
    operationalMode,
    activeIncidentId: selectedCrisisId,
    activeIncident,
    activeImpactData,
    enterIncidentMode,
    exitIncidentMode,
    selectedAsset,
    setSelectedAsset,
  };

  return (
    <WorldViewContext.Provider value={value}>
      {children}
    </WorldViewContext.Provider>
  );
}

export function useWorldView() {
  const ctx = useContext(WorldViewContext);
  if (!ctx) throw new Error('useWorldView must be used within WorldViewProvider');
  return ctx;
}

export default WorldViewContext;
