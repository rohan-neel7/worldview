import { useState, useEffect, useCallback, useRef } from 'react';
import * as Cesium from 'cesium';
import GlobeViewer from './components/GlobeViewer';
import DataLayersPanel from './components/DataLayersPanel';
import VisualControlsPanel from './components/VisualControlsPanel';
import LocationsPanel from './components/LocationsPanel';
import StylePresetsPanel from './components/StylePresetsPanel';
import CrisisIntelligencePanel from './components/CrisisIntelligencePanel';
import SatelliteLabels from './components/SatelliteLabels';
import { useWorldView } from './WorldViewContext';
import useFlights from './hooks/useFlights';
import useSatellites from './hooks/useSatellites';
import useEarthquakes from './hooks/useEarthquakes';
import useShips from './hooks/useShips';
import useGemini from './hooks/useGemini';
import { Globe } from 'lucide-react';
import './worldview.css';

const REGION_VIEWS = {
  GLOBAL: { lon: 20, lat: 20, alt: 25000000 },
  AMERICAS: { lon: -95, lat: 35, alt: 12000000 },
  EUROPE: { lon: 15, lat: 51, alt: 6000000 },
  ASIA_PACIFIC: { lon: 110, lat: 25, alt: 12000000 },
  MIDDLE_EAST: { lon: 45, lat: 26, alt: 6000000 },
  AFRICA: { lon: 20, lat: 5, alt: 10000000 },
};

function Clock() {
  const timeRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      if (timeRef.current) {
        timeRef.current.innerText = new Date().toISOString().replace('T', ' ').split('.')[0] + 'Z';
      }
    };
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      ref={timeRef}
      className="header-time" 
      style={{
        fontSize: 'var(--font-sm)',
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: '0.1em',
        marginTop: '4px',
        fontFamily: 'var(--font-mono)'
      }}
    >
      {new Date().toISOString().replace('T', ' ').split('.')[0] + 'Z'}
    </div>
  );
}

export default function App() {
  const {
    activeLayers,
    activePreset,
    flightCount,
    satelliteCount,
    earthquakeCount,
    setFlightCount,
    setSatelliteCount,
    setEarthquakeCount,
    setShipCount,
    showHUD,
    selectedRegion,
    setRegionStats,
  } = useWorldView();

  // Data Fetching Hooks
  const { data: flightData } = useFlights(activeLayers.flights, selectedRegion);
  const { data: satelliteData } = useSatellites(activeLayers.satellites);
  const { data: earthquakeData } = useEarthquakes(activeLayers.earthquakes, selectedRegion);
  const { data: shipData } = useShips(activeLayers.ships, selectedRegion);

  // State for GlobeViewer instance
  const [viewer, setViewer] = useState(null);

  // Selection callback refs (set by GlobeViewer)
  const satSelectFnRef = useRef(null);
  const flightSelectFnRef = useRef(null);

  // Region Camera Flight — uses REGION_VIEWS with proper altitudes
  useEffect(() => {
    if (!viewer || !selectedRegion) return;
    const view = REGION_VIEWS[selectedRegion];
    if (view) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          view.lon, view.lat, view.alt
        ),
        duration: 2
      });
    }
  }, [selectedRegion, viewer]);

  // Update region stats
  useEffect(() => {
    setRegionStats({
      flights: flightData?.length || 0,
      quakes: earthquakeData?.length || 0,
      sats: satelliteData?.length || 0,
      ships: shipData?.length || 0
    });
  }, [flightData, earthquakeData, satelliteData, shipData, setRegionStats]);

  const handleCountUpdate = useCallback((type, count) => {
    if (type === 'flights') setFlightCount(count);
    if (type === 'satellites') setSatelliteCount(count);
    if (type === 'earthquakes') setEarthquakeCount(count);
    if (type === 'ships') setShipCount(count);
  }, [setFlightCount, setSatelliteCount, setEarthquakeCount, setShipCount]);

  // Intelligence Logic
  const topQuake = earthquakeData?.[0] || null;
  const gemini = useGemini({
    flightCount,
    quakeCount: earthquakeCount,
    satCount: satelliteCount,
    topQuake,
    selectedRegion
  });

  return (
    <div className="worldview-app">
      <div className="background-grid" />
      {/* ── Background Globe ── */}
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

      {/* ── Satellite Floating Labels ── */}
      {showHUD && activeLayers.satellites && (
        <SatelliteLabels
          viewer={viewer}
          satelliteData={satelliteData}
          onSatelliteClick={(name, tle1, tle2, lat, lon, alt) => {
            if (satSelectFnRef.current) satSelectFnRef.current(name, tle1, tle2, lat, lon, alt);
          }}
        />
      )}

      {/* ── Left Fixed Panel ── */}
      {showHUD && (
        <aside className="left-panel">
          <header className="header-main">
            <div className="header-title-row">
              <Globe size={24} color="var(--color-cyan)" strokeWidth={2.5} /> WORLDVIEW
            </div>
            <div className="header-subtitle">REAL-TIME GEOSPATIAL INTELLIGENCE</div>
            <div className="header-classification">
              UNCLASSIFIED // OPEN SOURCE OSINT
            </div>
            <Clock />
          </header>
          <DataLayersPanel
            flightData={flightData}
            earthquakeData={earthquakeData}
            satelliteData={satelliteData}
            shipData={shipData}
            viewer={viewer}
            onSelectFlight={(flight) => {
              if (flightSelectFnRef.current) flightSelectFnRef.current(flight);
            }}
          />
        </aside>
      )}

      {/* ── Right Fixed Panel ── */}
      <aside className="right-panel">
        <VisualControlsPanel
          viewer={viewer}
          earthquakeData={earthquakeData}
        />
      </aside>

      {/* ── Bottom Right Crisis Intelligence ── */}
      {showHUD && (
        <CrisisIntelligencePanel
          onTrigger={gemini.runAnalysis}
          loading={gemini.loading}
        />
      )}

      {/* ── Bottom Floating Dock ── */}
      {showHUD && (
        <div className="floating-dock">
          <div className="compact-panel locations">
            <div className="compact-header">
              LOCATIONS <span>[+]</span>
            </div>
            <LocationsPanel />
          </div>

          <div className="compact-panel presets">
            <div className="compact-header">
              STYLE: {activePreset}
            </div>
            <StylePresetsPanel />
          </div>
        </div>
      )}

    </div>
  );
}
