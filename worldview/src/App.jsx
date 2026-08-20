import { useState, useEffect, useCallback, useRef } from 'react';
import * as Cesium from 'cesium';
import GlobeViewer from './components/GlobeViewer';
import PrimaryModeBar from './components/PrimaryModeBar';
import BottomStatusBar from './components/BottomStatusBar';
import WorldModeWorkspace from './components/world/WorldModeWorkspace';
import CrisisModeWorkspace from './components/crisis/CrisisModeWorkspace';
import { useWorldView } from './WorldViewContext';
import { globalDataPipeline, BENGALURU_FLOOD_SCENARIO } from './engine/index.js';
import useFlights from './hooks/useFlights';
import useSatellites from './hooks/useSatellites';
import useEarthquakes from './hooks/useEarthquakes';
import useShips from './hooks/useShips';
import useGemini from './hooks/useGemini';
import './worldview.css';

const REGION_VIEWS = {
  GLOBAL: { lon: 20, lat: 20, alt: 25000000 },
  AMERICAS: { lon: -95, lat: 35, alt: 12000000 },
  EUROPE: { lon: 15, lat: 51, alt: 6000000 },
  ASIA_PACIFIC: { lon: 110, lat: 25, alt: 12000000 },
  MIDDLE_EAST: { lon: 45, lat: 26, alt: 6000000 },
  AFRICA: { lon: 20, lat: 5, alt: 10000000 },
};

export default function App() {
  const {
    activeMode,
    isWorldMode,
    isCrisisMode,
    selectedCountry,
    activeLayers,
    activePreset,
    flightCount,
    satelliteCount,
    earthquakeCount,
    shipCount,
    setFlightCount,
    setSatelliteCount,
    setEarthquakeCount,
    setShipCount,
    showHUD,
    selectedRegion,
    setRegionStats,
    setIncidents,
    setPipelineMetrics,
    setSimulationStatus,
    operationalMode,
    activeIncident,
    activeImpactData,
    enterIncidentMode,
    exitIncidentMode,
    selectedCrisis,
    clearSelectedCrisis,
    refreshCrisisDiscovery,
  } = useWorldView();

  // ── Workload Separation: Suspend Global-Only Feeds in Crisis Mode ──
  const flightsEnabled = isWorldMode && Boolean(activeLayers.flights);
  const satsEnabled = isWorldMode && Boolean(activeLayers.satellites);
  const shipsEnabled = isWorldMode && Boolean(activeLayers.ships);
  const quakesEnabled = Boolean(activeLayers.earthquakes);

  const { data: flightData } = useFlights(flightsEnabled, selectedRegion);
  const { data: satelliteData } = useSatellites(satsEnabled);
  const { data: earthquakeData } = useEarthquakes(quakesEnabled, selectedRegion);
  const { data: shipData } = useShips(shipsEnabled, selectedRegion);

  // ── Ingest Telemetry & Run Country Discovery ──
  useEffect(() => {
    if (earthquakeData && earthquakeData.length > 0) {
      globalDataPipeline.ingestRaw('USGS', earthquakeData, { sourceMode: 'LIVE' });
      const currentIncidents = globalDataPipeline.getIncidents();
      setIncidents(currentIncidents);
      setPipelineMetrics(globalDataPipeline.getPipelineMetrics());
      refreshCrisisDiscovery(earthquakeData);
    } else {
      refreshCrisisDiscovery([]);
    }
  }, [earthquakeData, setIncidents, setPipelineMetrics, refreshCrisisDiscovery]);

  useEffect(() => {
    if (isWorldMode && flightData && flightData.length > 0) {
      globalDataPipeline.ingestRaw('OpenSky', flightData, { sourceMode: 'LIVE' });
      setPipelineMetrics(globalDataPipeline.getPipelineMetrics());
    }
  }, [flightData, isWorldMode, setPipelineMetrics]);

  useEffect(() => {
    if (isWorldMode && satelliteData && satelliteData.length > 0) {
      globalDataPipeline.ingestRaw('CelesTrak', satelliteData, { sourceMode: 'LIVE' });
      setPipelineMetrics(globalDataPipeline.getPipelineMetrics());
    }
  }, [satelliteData, isWorldMode, setPipelineMetrics]);

  useEffect(() => {
    if (isWorldMode && shipData && shipData.length > 0) {
      globalDataPipeline.ingestRaw('AISStream', shipData, { sourceMode: 'LIVE' });
      setPipelineMetrics(globalDataPipeline.getPipelineMetrics());
    }
  }, [shipData, isWorldMode, setPipelineMetrics]);

  // Simulation Trigger Handlers
  const handleTriggerFloodSimulation = useCallback(() => {
    globalDataPipeline.scenarioRunner.runInstant(BENGALURU_FLOOD_SCENARIO);
    const incs = globalDataPipeline.getIncidents();
    setIncidents(incs);
    setPipelineMetrics(globalDataPipeline.getPipelineMetrics());
    setSimulationStatus({
      active: true,
      completed: true,
      scenarioName: BENGALURU_FLOOD_SCENARIO.name,
    });
    if (incs.length > 0) {
      enterIncidentMode(incs[0].id);
    }
  }, [setIncidents, setPipelineMetrics, setSimulationStatus, enterIncidentMode]);

  const handleResetSimulation = useCallback(() => {
    globalDataPipeline.clear();
    setIncidents([]);
    setPipelineMetrics(globalDataPipeline.getPipelineMetrics());
    setSimulationStatus({
      active: false,
      completed: false,
      scenarioName: null,
    });
    exitIncidentMode();
  }, [setIncidents, setPipelineMetrics, setSimulationStatus, exitIncidentMode]);

  // State for GlobeViewer instance
  const [viewer, setViewer] = useState(null);

  // Selection callback refs (set by GlobeViewer)
  const satSelectFnRef = useRef(null);
  const flightSelectFnRef = useRef(null);

  // Region Camera Flight — only in WORLD mode
  useEffect(() => {
    if (!viewer || !selectedRegion || activeMode !== 'WORLD') return;
    const view = REGION_VIEWS[selectedRegion];
    if (view) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(view.lon, view.lat, view.alt),
        duration: 2,
      });
    }
  }, [selectedRegion, viewer, activeMode]);

  // Update region stats
  useEffect(() => {
    setRegionStats({
      flights: flightData?.length || 0,
      quakes: earthquakeData?.length || 0,
      sats: satelliteData?.length || 0,
      ships: shipData?.length || 0,
    });
  }, [flightData, earthquakeData, satelliteData, shipData, setRegionStats]);

  const handleCountUpdate = useCallback((type, count) => {
    if (type === 'flights') setFlightCount(count);
    if (type === 'satellites') setSatelliteCount(count);
    if (type === 'earthquakes') setEarthquakeCount(count);
    if (type === 'ships') setShipCount(count);
  }, [setFlightCount, setSatelliteCount, setEarthquakeCount, setShipCount]);

  // Intelligence & Gemini Logic
  const topQuake = earthquakeData?.[0] || null;
  const gemini = useGemini({
    flightCount,
    quakeCount: earthquakeCount,
    satCount: satelliteCount,
    topQuake,
    selectedRegion,
    activeIncident,
    activeImpactData,
  });

  const handleLaunchIncidentCommand = useCallback(() => {
    if (!activeIncident && topQuake) {
      enterIncidentMode(`hyp-earthquake-usgs_${topQuake.id}`);
    } else if (activeIncident) {
      enterIncidentMode(activeIncident.id);
    }
    gemini.runAnalysis();
  }, [activeIncident, topQuake, enterIncidentMode, gemini]);

  return (
    <div className={`worldview-app mode-${activeMode.toLowerCase()}`}>
      <div className="background-grid" />

      {/* ── Primary Top Mode Selector Bar ── */}
      <PrimaryModeBar />

      {/* ── Background Cesium Globe ── */}
      <GlobeViewer
        flightData={flightData}
        satelliteData={satelliteData}
        earthquakeData={earthquakeData}
        shipData={shipData}
        activeLayers={activeLayers}
        selectedRegion={selectedRegion}
        onViewerReady={setViewer}
        onCountUpdate={handleCountUpdate}
        onSatelliteSelect={(fn) => { satSelectFnRef.current = fn; }}
        onFlightSelect={(fn) => { flightSelectFnRef.current = fn; }}
      />

      {/* ═══════════════════════════════════════════════════════════════
          MODE 1: WORLD SITUATIONAL AWARENESS WORKSPACE
      ═══════════════════════════════════════════════════════════════ */}
      {isWorldMode && (
        <WorldModeWorkspace
          flightData={flightData}
          satelliteData={satelliteData}
          earthquakeData={earthquakeData}
          shipData={shipData}
          viewer={viewer}
          satSelectFnRef={satSelectFnRef}
          flightSelectFnRef={flightSelectFnRef}
          onLaunchIncidentCommand={handleLaunchIncidentCommand}
          onTriggerFloodSimulation={handleTriggerFloodSimulation}
          onResetSimulation={handleResetSimulation}
          gemini={gemini}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODE 2: CRISIS INTELLIGENCE WORKSPACE (Country-First Flow)
      ═══════════════════════════════════════════════════════════════ */}
      {isCrisisMode && (
        <CrisisModeWorkspace
          earthquakeData={earthquakeData}
          viewer={viewer}
          geminiReport={gemini.structuredReport}
          geminiLoading={gemini.loading}
          onTriggerGemini={gemini.runAnalysis}
        />
      )}

      {/* ── Low-Frequency Bottom Operational Status Bar ── */}
      <BottomStatusBar />
    </div>
  );
}
