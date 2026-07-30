import { createContext, useContext, useState, useCallback } from 'react';

const WorldViewContext = createContext(null);

const DEFAULT_LAYERS = {
  flights: true,
  militaryFlights: false,
  earthquakes: true,
  satellites: true,
  ships: true,
  weather: false,
};

const LAYER_META = {
  flights: { label: 'Live Flights', source: 'ADSB', interval: '10s' },
  militaryFlights: { label: 'Military Flights', source: 'ADSB', interval: '30s' },
  earthquakes: { label: 'Earthquakes 24h', source: 'USGS', interval: '5min' },
  satellites: { label: 'Satellites', source: 'CelesTrak', interval: '30s' },
  ships: { label: 'Ships (AIS)', source: 'AISstream', interval: 'live' },
  weather: { label: 'Weather Radar', source: 'NOAA', interval: '5min' },
};

export const REGIONS = {
  GLOBAL: { name: 'Global', lat: 30, lon: 0, dist: 9999 },
  AMERICAS: { name: 'Americas', lat: 35, lon: -95, dist: 4000 },
  EUROPE: { name: 'Europe', lat: 51, lon: 15, dist: 2500 },
  ASIA_PACIFIC: { name: 'Asia-Pacific', lat: 25, lon: 110, dist: 4000 },
  MIDDLE_EAST: { name: 'Middle East', lat: 25, lon: 45, dist: 2500 },
  AFRICA: { name: 'Africa', lat: 0, lon: 20, dist: 3500 },
};

const PRESETS = ['NORMAL', 'CRT', 'NVG', 'FLIR', 'NOIR', 'SNOW'];

export function WorldViewProvider({ children }) {
  // Layer toggles
  const [activeLayers, setActiveLayers] = useState(DEFAULT_LAYERS);
  const toggleLayer = useCallback((layerId) => {
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  // Visual preset
  const [activePreset, setActivePreset] = useState('NORMAL');

  // Data counts (updated by hooks)
  const [flightCount, setFlightCount] = useState(0);
  const [satelliteCount, setSatelliteCount] = useState(0);
  const [earthquakeCount, setEarthquakeCount] = useState(0);
  const [shipCount, setShipCount] = useState(0);

  // Region filtering
  const [selectedRegion, setSelectedRegion] = useState('GLOBAL');
  const [regionStats, setRegionStats] = useState({ flights: 0, quakes: 0, sats: 0, ships: 0 });

  // Summaries
  const [weatherSummary, setWeatherSummary] = useState('NO DATA');
  const [trafficLevel, setTrafficLevel] = useState('UNKNOWN');

  // Gemini analysis
  const [geminiOutput, setGeminiOutput] = useState(null);

  // HUD Visibility
  const [showHUD, setShowHUD] = useState(true);

  // Layout mode (Tactical / Minimal / Scientific)
  const [layout, setLayout] = useState('Tactical');

  // Camera state (updated by GlobeViewer)
  const [cameraPosition, setCameraPosition] = useState({
    lat: 0,
    lon: 0,
    alt: 15000000,
  });

  const value = {
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

    // Layout
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
