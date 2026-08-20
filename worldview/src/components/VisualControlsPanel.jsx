import React, { useState, useCallback, useEffect } from 'react';
import * as Cesium from 'cesium';
import { useWorldView } from '../WorldViewContext';
import { 
  Layers, 
  ZoomIn, 
  ZoomOut,
  AlertTriangle,
  Search,
  Sliders,
  Database,
  Radio
} from 'lucide-react';
import DataStateBadge from './common/DataStateBadge';

export default function VisualControlsPanel({ 
  viewer, 
  earthquakeData, 
  onDetectCrisis,
  onSimulateFlood,
  onResetSimulation,
  onOpenViewSettings,
}) {
  const {
    activePreset,
    cameraPosition,
    incidents,
    pipelineMetrics,
    simulationStatus,
    enterIncidentMode,
  } = useWorldView();

  const [time, setTime] = useState(new Date().toISOString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.replace('T', ' ').toUpperCase().split('.')[0] + 'Z';

  // Zoom Controls
  const handleZoomIn = useCallback(() => {
    if (!viewer || viewer.isDestroyed?.()) return;
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
  }, [viewer]);

  const handleZoomOut = useCallback(() => {
    if (!viewer || viewer.isDestroyed?.()) return;
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5);
  }, [viewer]);

  // Detect Highest Magnitude
  const handleDetect = useCallback(() => {
    if (earthquakeData && earthquakeData.length > 0) {
      const biggest = earthquakeData.reduce((prev, current) =>
        ((prev.magnitude || 0) > (current.magnitude || 0)) ? prev : current
      );
      if (viewer && biggest.lon && biggest.lat) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(biggest.lon, biggest.lat, 500000),
          duration: 2
        });
      }
      if (enterIncidentMode) {
        enterIncidentMode(`hyp-earthquake-usgs_${biggest.id}`);
      }
    }
    if (onDetectCrisis) onDetectCrisis();
  }, [viewer, earthquakeData, onDetectCrisis, enterIncidentMode]);

  const formatAlt = (alt) => {
    if (alt > 1000000) return `${(alt / 1000000).toFixed(1)}M m`;
    if (alt > 1000) return `${(alt / 1000).toFixed(1)}K m`;
    return `${Math.round(alt)} m`;
  };

  return (
    <div className="visual-controls-panel flex flex-col gap-3" aria-label="Global Surveillance Controls">
      {/* ── Context Header & View Settings Trigger ── */}
      <div className="panel-stats-top p-3 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="stats-label font-mono text-xs text-muted uppercase font-semibold">WORLD SURVEILLANCE</span>
          <DataStateBadge state="LIVE" size="sm" />
        </div>

        <div className="flex items-center justify-between my-1">
          <div className="flex items-center gap-1.5 font-display font-bold text-white text-sm">
            <Radio size={14} className="text-cyan animate-pulse" />
            <span>GLOBAL OSINT FEED</span>
          </div>

          <button 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-display font-semibold text-cyan hover:text-white"
            style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}
            onClick={onOpenViewSettings}
            title="Open Display Settings & Preset Shaders"
          >
            <Sliders size={12} />
            <span>VIEW SETTINGS</span>
          </button>
        </div>

        <div className="text-xs font-mono text-muted flex items-center justify-between pt-1 border-t border-white/5">
          <span>ACTIVE PRESET: <strong className="text-cyan">{activePreset}</strong></span>
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* ── Camera Telemetry Info ── */}
      <div className="p-3 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-display font-semibold text-xs text-cyan uppercase">CAMERA TELEMETRY</span>
          <span className="font-mono text-xs text-muted">NADIR VIEW</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-xs mb-2.5">
          <div className="p-1.5 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block text-micro">LATITUDE</span>
            <span className="text-white font-bold">{cameraPosition.lat.toFixed(2)}°</span>
          </div>
          <div className="p-1.5 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block text-micro">LONGITUDE</span>
            <span className="text-white font-bold">{cameraPosition.lon.toFixed(2)}°</span>
          </div>
          <div className="p-1.5 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block text-micro">ALTITUDE</span>
            <span className="text-cyan font-bold truncate">{formatAlt(cameraPosition.alt)}</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-1.5 p-1.5 rounded font-display text-xs font-semibold text-white hover:bg-white/10" style={{ background: 'var(--surface-l3)', border: '1px solid var(--border-subtle)' }} onClick={handleZoomIn}>
            <ZoomIn size={13} className="text-cyan" />
            <span>ZOOM IN</span>
          </button>
          <button className="flex items-center justify-center gap-1.5 p-1.5 rounded font-display text-xs font-semibold text-white hover:bg-white/10" style={{ background: 'var(--surface-l3)', border: '1px solid var(--border-subtle)' }} onClick={handleZoomOut}>
            <ZoomOut size={13} className="text-cyan" />
            <span>ZOOM OUT</span>
          </button>
        </div>
      </div>

      {/* ── Intelligence Pipeline Summary ── */}
      <div className="p-3 rounded flex flex-col gap-2" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-display font-semibold text-xs text-white uppercase">
            <Database size={13} className="text-cyan" />
            <span>DATA INGEST PIPELINE</span>
          </div>
          <span className="font-mono text-xs text-green font-bold">OPERATIONAL</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-body">
          <div className="p-1.5 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block font-mono" style={{ fontSize: '10px' }}>INGESTED EVENTS</span>
            <span className="font-mono font-bold text-white text-sm">{pipelineMetrics?.activeEventsInStore || 0}</span>
          </div>
          <div className="p-1.5 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block font-mono" style={{ fontSize: '10px' }}>ACTIVE INCIDENTS</span>
            <span className="font-mono font-bold text-cyan text-sm">{incidents?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* ── Operational Scenario Commands ── */}
      <div className="flex flex-col gap-2">
        <button 
          className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded font-display font-semibold text-xs text-white"
          style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid var(--color-cyan)' }}
          onClick={handleDetect}
        >
          <Search size={14} className="text-cyan" />
          <span>INSPECT SEISMIC INCIDENT</span>
        </button>

        <button 
          className="w-full flex items-center justify-center gap-1.5 p-2 rounded font-display text-xs font-semibold text-muted hover:text-white"
          style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}
          onClick={simulationStatus?.active ? onResetSimulation : onSimulateFlood}
        >
          <AlertTriangle size={13} className={simulationStatus?.active ? 'text-yellow' : 'text-muted'} />
          <span>{simulationStatus?.active ? 'RESET SIMULATION' : 'SIMULATE FLOOD SCENARIO'}</span>
        </button>
      </div>
    </div>
  );
}
