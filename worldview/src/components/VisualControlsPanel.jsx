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
  Crosshair
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

export default function VisualControlsPanel({ viewer, earthquakeData }) {
  const {
    activePreset,
    flightCount,
    satelliteCount,
    earthquakeCount,
    showHUD,
    setShowHUD,
    cameraPosition,
    layout,
    setLayout,
  } = useWorldView();

  const [isPanning, setIsPanning] = useState(false);
  const [bloomEnabled, setBloomEnabled] = useState(false);
  const [sharpenValue, setSharpenValue] = useState(0);
  const [fogDensity, setFogDensity] = useState(0.0002);
  const [atmosEnabled, setAtmosEnabled] = useState(true);
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

  // ── Detect Highest Magnitude ──
  const handleDetect = useCallback(() => {
    if (!viewer || !earthquakeData || earthquakeData.length === 0) return;
    const biggest = earthquakeData.reduce((prev, current) =>
      (prev.magnitude > current.magnitude) ? prev : current
    );
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(biggest.lon, biggest.lat, 500000),
      duration: 2
    });
  }, [viewer, earthquakeData]);

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
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(20, 20, 25000000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  }, [viewer]);

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

  return (
    <div className="visual-controls-panel">
      {/* ── Top Stats ── */}
      <div className="panel-stats-top">
        <div className="stats-label">PRIMARY INTERFACE</div>
        <div className="stats-value">
          <Layers size={18} color="var(--color-cyan)" /> {activePreset}
        </div>
        <div className="stats-recording">
          <div className="recording-dot" />
          <span>SYSTEM FEED {formattedTime}</span>
        </div>
      </div>

      {/* ── Camera Info ── */}
      <div className="vc-section-divider">
        <span className="vc-section-label">TELEMETRY</span>
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

      {/* ── Visual Controls ── */}
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

      {/* ── Actions ── */}
      <div className="vc-section-divider">
        <span className="vc-section-label">COMMANDS</span>
        <div className="vc-section-line" />
      </div>

      <div className="control-row">
        <button className="control-btn action-btn" onClick={handleDetect}>
          <Search size={14} /> DETECT CRISIS
        </button>
      </div>

      <div className="control-row">
        <button className="control-btn action-btn screenshot-btn" onClick={handleScreenshot}>
          <Camera size={14} /> SAVE FRAME
        </button>
      </div>

      <div className="control-row">
        <button className="control-btn action-btn reset-btn" onClick={handleResetView}>
          <RefreshCw size={14} /> RECENTER GLOBE
        </button>
      </div>

      {/* ── System Status ── */}
      <div className="system-status">
        <div className="status-label-main">NETWORK STATUS</div>
        <div className="status-item">
          <label>DATA LINK</label>
          <span className="status-ok">ESTABLISHED</span>
        </div>
        <div className="status-item">
          <label>SAT CONN</label>
          <span className="status-ok">ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
