import { useState, useRef, useCallback, useEffect } from 'react';
import * as Cesium from 'cesium';
import { useWorldView } from '../WorldViewContext';
import { 
  Move, 
  Sun, 
  Layers, 
  Layout, 
  Camera, 
  RefreshCw, 
  Search, 
  ZoomIn, 
  ZoomOut,
  Crosshair,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Compass,
  Activity,
  Building2,
  Plane
} from 'lucide-react';

// Sharpen fragment shader for Cesium PostProcessStage
const SHARPEN_SHADER = `
  uniform sampler2D colorTexture;
  uniform float sharpness;
  in vec2 v_textureCoordinates;
  void main() {
    vec2 step = 1.0 / czm_viewport.zw;
    vec4 center = texture(colorTexture, v_textureCoordinates);
    vec4 left   = texture(colorTexture, v_textureCoordinates - vec2(step.x, 0.0));
    vec4 right  = texture(colorTexture, v_textureCoordinates + vec2(step.x, 0.0));
    vec4 top    = texture(colorTexture, v_textureCoordinates + vec2(0.0, step.y));
    vec4 bottom = texture(colorTexture, v_textureCoordinates - vec2(0.0, step.y));
    vec4 sharpened = center * (1.0 + 4.0 * sharpness) - (left + right + top + bottom) * sharpness;
    out_FragColor = clamp(sharpened, 0.0, 1.0);
  }
`;

// Bloom-like glow shader
const BLOOM_SHADER = `
  uniform sampler2D colorTexture;
  in vec2 v_textureCoordinates;
  void main() {
    vec2 step = 1.5 / czm_viewport.zw;
    vec4 color = texture(colorTexture, v_textureCoordinates);
    vec4 sum = vec4(0.0);
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        sum += texture(colorTexture, v_textureCoordinates + vec2(float(x), float(y)) * step);
      }
    }
    sum /= 25.0;
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float bloom = smoothstep(0.45, 0.9, lum);
    out_FragColor = color + sum * bloom * 0.35;
  }
`;

export default function VisualControlsPanel({ 
  viewer, 
  earthquakeData, 
  onDetectCrisis,
  onSimulateFlood,
  onResetSimulation
}) {
  const {
    activePreset,
    showHUD,
    setShowHUD,
    cameraPosition,
    layout,
    setLayout,
    incidents,
    pipelineMetrics,
    simulationStatus,
    operationalMode,
    activeIncident,
    activeImpactData,
    enterIncidentMode,
    exitIncidentMode,
  } = useWorldView();

  const [isPanning, setIsPanning] = useState(false);
  const [bloomEnabled, setBloomEnabled] = useState(false);
  const [sharpenValue, setSharpenValue] = useState(0);
  const [time, setTime] = useState(new Date().toISOString());

  // Post-process refs
  const sharpenStageRef = useRef(null);
  const bloomStageRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.replace('T', ' ').toUpperCase().split('.')[0] + 'Z';

  // ── Motion (rotation lock) ──
  const handleMove = useCallback(() => {
    if (!viewer) return;
    const rotateEnabled = viewer.scene.screenSpaceCameraController.enableRotate;
    viewer.scene.screenSpaceCameraController.enableRotate = !rotateEnabled;
    setIsPanning(!rotateEnabled);
  }, [viewer]);

  // ── Bloom Toggle ──
  const handleToggleBloom = useCallback(() => {
    if (!viewer) return;
    if (bloomEnabled) {
      if (bloomStageRef.current) {
        try { viewer.scene.postProcessStages.remove(bloomStageRef.current); } catch (e) {}
        bloomStageRef.current = null;
      }
      setBloomEnabled(false);
    } else {
      const stage = new Cesium.PostProcessStage({ fragmentShader: BLOOM_SHADER });
      viewer.scene.postProcessStages.add(stage);
      bloomStageRef.current = stage;
      setBloomEnabled(true);
    }
  }, [viewer, bloomEnabled]);

  // ── Sharpen Slider ──
  const handleSharpen = useCallback((e) => {
    if (!viewer) return;
    const val = parseInt(e.target.value, 10);
    setSharpenValue(val);
    const intensity = val / 100;

    if (val === 0) {
      if (sharpenStageRef.current) {
        try { viewer.scene.postProcessStages.remove(sharpenStageRef.current); } catch (e) {}
        sharpenStageRef.current = null;
      }
      return;
    }

    if (sharpenStageRef.current) {
      sharpenStageRef.current.uniforms.sharpness = intensity;
    } else {
      const stage = new Cesium.PostProcessStage({
        fragmentShader: SHARPEN_SHADER,
        uniforms: { sharpness: intensity }
      });
      viewer.scene.postProcessStages.add(stage);
      sharpenStageRef.current = stage;
    }
  }, [viewer]);

  // ── HUD Toggle ──
  const handleToggleHUD = useCallback(() => {
    setShowHUD(!showHUD);
  }, [showHUD, setShowHUD]);

  // ── Layout Selector ──
  const handleLayoutChange = useCallback((e) => {
    const mode = e.target.value;
    setLayout(mode);
    if (mode === 'Minimal') {
      setShowHUD(false);
    } else {
      setShowHUD(true);
    }
  }, [setLayout, setShowHUD]);

  // ── Detect Highest Magnitude & Trigger Crisis ──
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

  // ── Zoom Controls ──
  const handleZoomIn = useCallback(() => {
    if (!viewer) return;
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
  }, [viewer]);

  const handleZoomOut = useCallback(() => {
    if (!viewer) return;
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5);
  }, [viewer]);

  // ── Screenshot ──
  const handleScreenshot = useCallback(() => {
    if (!viewer) return;
    viewer.render();
    const canvas = viewer.canvas;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `worldview-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.warn('Screenshot failed:', e);
    }
  }, [viewer]);

  // ── Reset View ──
  const handleResetView = useCallback(() => {
    if (!viewer) return;
    if (operationalMode === 'INCIDENT') {
      exitIncidentMode();
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(20, 20, 25000000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  }, [viewer, operationalMode, exitIncidentMode]);

  useEffect(() => {
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        if (sharpenStageRef.current) {
          try { viewer.scene.postProcessStages.remove(sharpenStageRef.current); } catch (e) {}
        }
        if (bloomStageRef.current) {
          try { viewer.scene.postProcessStages.remove(bloomStageRef.current); } catch (e) {}
        }
      }
    };
  }, [viewer]);

  const formatAlt = (alt) => {
    if (alt > 1000000) return `${(alt / 1000000).toFixed(1)}M m`;
    if (alt > 1000) return `${(alt / 1000).toFixed(1)}K m`;
    return `${Math.round(alt)} m`;
  };

  const isIncidentMode = operationalMode === 'INCIDENT' && Boolean(activeIncident);

  return (
    <div className="visual-controls-panel">
      {/* ── Context Header ── */}
      <div className="panel-stats-top">
        <div className="stats-label">
          {isIncidentMode ? 'INCIDENT COMMAND ACTIVE' : 'GLOBAL MONITORING'}
        </div>
        <div className="stats-value" style={{ color: isIncidentMode ? '#FF3333' : 'var(--color-cyan)' }}>
          {isIncidentMode ? <ShieldAlert size={18} color="#FF3333" /> : <Layers size={18} color="var(--color-cyan)" />}
          {isIncidentMode ? activeIncident.title.slice(0, 18) + '...' : activePreset}
        </div>
        <div className="stats-recording">
          <div className={`recording-dot ${isIncidentMode ? 'pulse-red' : ''}`} />
          <span>{isIncidentMode ? 'LIVE DISASTER COMMAND' : `SYSTEM FEED ${formattedTime}`}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CONTEXTUAL INCIDENT STATUS (When Incident is Active)
      ═══════════════════════════════════════════════════════════════ */}
      {isIncidentMode && (
        <div className="active-incident-card-panel">
          <div className="incident-panel-badge">
            <span className="sev-dot-red" />
            <span>RISK: {activeIncident.risk?.severity || 'HIGH'} ({activeIncident.risk?.score || 75}/100)</span>
          </div>

          <div className="incident-panel-metrics">
            <div className="inc-metric-row">
              <span>LOCATION:</span>
              <strong>{activeIncident.location?.name || 'Epicentral Zone'}</strong>
            </div>
            <div className="inc-metric-row">
              <span>EXPOSED POP:</span>
              <strong className="highlight-amber">
                ~{(activeImpactData?.exposureMetrics?.populationExposed || 0).toLocaleString()}
              </strong>
            </div>
            <div className="inc-metric-row">
              <span>HOSPITALS:</span>
              <strong className="highlight-red">
                {activeImpactData?.exposureMetrics?.hospitalsCount || 0} in zone
              </strong>
            </div>
            <div className="inc-metric-row">
              <span>CONFIDENCE:</span>
              <strong className="highlight-cyan">
                {Math.round((activeIncident.confidence || 0.95) * 100)}%
              </strong>
            </div>
          </div>

          <button 
            className="incident-open-dossier-btn"
            onClick={onDetectCrisis}
          >
            <ShieldAlert size={14} /> OPEN COMMAND DOSSIER
          </button>

          <button 
            className="incident-exit-mode-btn"
            onClick={exitIncidentMode}
          >
            <Compass size={14} /> RETURN TO WORLD MODE
          </button>
        </div>
      )}

      {/* ── Camera Telemetry Info ── */}
      <div className="vc-section-divider">
        <span className="vc-section-label">CAMERA TELEMETRY</span>
        <div className="vc-section-line" />
      </div>
      <div className="camera-info-grid">
        <div className="camera-info-item">
          <span className="camera-info-label">LATITUDE</span>
          <span className="camera-info-value">{cameraPosition.lat.toFixed(4)}</span>
        </div>
        <div className="camera-info-item">
          <span className="camera-info-label">LONGITUDE</span>
          <span className="camera-info-value">{cameraPosition.lon.toFixed(4)}</span>
        </div>
        <div className="camera-info-item camera-info-alt">
          <span className="camera-info-label">ALTITUDE</span>
          <span className="camera-info-value">{formatAlt(cameraPosition.alt)}</span>
        </div>
      </div>

      {/* ── Zoom Controls ── */}
      <div className="zoom-btn-row">
        <button className="zoom-btn" onClick={handleZoomIn}>
          <ZoomIn size={14} /> ZOOM IN
        </button>
        <button className="zoom-btn" onClick={handleZoomOut}>
          <ZoomOut size={14} /> ZOOM OUT
        </button>
      </div>

      {/* ── Visual Operations ── */}
      <div className="vc-section-divider">
        <span className="vc-section-label">OPERATIONS</span>
        <div className="vc-section-line" />
      </div>

      <div className="control-row">
        <label className="control-label">ROTATION LOCK</label>
        <button
          className={`control-btn ${isPanning ? 'active' : ''}`}
          onClick={handleMove}
        >
          <Move size={14} /> {isPanning ? 'UNLOCKED' : 'LOCKED'}
        </button>
      </div>

      <div className="control-row">
        <label className="control-label">ATMOSPHERIC BLOOM</label>
        <button
          className={`control-btn ${bloomEnabled ? 'active' : ''}`}
          onClick={handleToggleBloom}
        >
          <Sun size={14} /> {bloomEnabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      <div className="control-row">
        <label className="control-label">SENSOR SHARPEN <span className="slider-val">{sharpenValue}%</span></label>
        <input
          type="range"
          min="0"
          max="100"
          value={sharpenValue}
          onChange={handleSharpen}
          className="vc-slider"
        />
      </div>

      <div className="control-row">
        <label className="control-label">HUD OVERLAY</label>
        <button
          className={`control-btn ${showHUD ? 'active' : ''}`}
          onClick={handleToggleHUD}
        >
          <Crosshair size={14} /> {showHUD ? 'ACTIVE' : 'INACTIVE'}
        </button>
      </div>

      <div className="control-row">
        <label className="control-label">VISUAL LAYOUT</label>
        <div style={{ position: 'relative' }}>
          <select className="vc-select" value={layout} onChange={handleLayoutChange}>
            <option value="Tactical">TACTICAL</option>
            <option value="Minimal">MINIMAL</option>
            <option value="Scientific">SCIENTIFIC</option>
          </select>
          <Layout size={14} className="select-icon" />
        </div>
      </div>

      {/* ── Commands ── */}
      <div className="vc-section-divider">
        <span className="vc-section-label">COMMANDS</span>
        <div className="vc-section-line" />
      </div>

      <div className="control-row">
        <button 
          className={`control-btn action-btn ${simulationStatus?.active ? 'active' : ''}`} 
          onClick={simulationStatus?.active ? onResetSimulation : onSimulateFlood}
          title="Run deterministic multi-stage Bengaluru flash-flood simulation scenario"
        >
          <AlertTriangle size={14} color={simulationStatus?.active ? '#FFD700' : 'var(--color-cyan)'} /> 
          {simulationStatus?.active ? 'RESET SIMULATION' : 'SIMULATE FLOOD'}
        </button>
      </div>

      <div className="control-row">
        <button className="control-btn action-btn primary-action" onClick={handleDetect}>
          <Search size={14} /> INSPECT SEISMIC CRISIS
        </button>
      </div>

      <div className="control-row">
        <button className="control-btn action-btn screenshot-btn" onClick={handleScreenshot}>
          <Camera size={14} /> SAVE FRAME
        </button>
      </div>

      <div className="control-row">
        <button className="control-btn action-btn reset-btn" onClick={handleResetView}>
          <RefreshCw size={14} /> {isIncidentMode ? 'EXIT INCIDENT' : 'RECENTER GLOBE'}
        </button>
      </div>

      {/* ── System Status ── */}
      <div className="system-status">
        <div className="status-label-main">INTELLIGENCE PIPELINE</div>
        <div className="status-item">
          <label>FUSION ENGINE</label>
          <span className="status-ok">OPERATIONAL</span>
        </div>
        <div className="status-item">
          <label>DATA INGEST</label>
          <span className="status-ok">
            {pipelineMetrics?.liveCount || 0} LIVE / {pipelineMetrics?.simulatedCount || 0} SIM
          </span>
        </div>
        <div className="status-item">
          <label>ACTIVE INCIDENTS</label>
          <span className={incidents?.length > 0 ? 'status-alert' : 'status-ok'}>
            {incidents?.length || 0} TRACKED
          </span>
        </div>
      </div>
    </div>
  );
}
