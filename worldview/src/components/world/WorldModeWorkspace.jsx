import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as Cesium from 'cesium';
import { useWorldView } from '../../WorldViewContext.jsx';
import DataLayersPanel from '../DataLayersPanel.jsx';
import VisualControlsPanel from '../VisualControlsPanel.jsx';
import SatelliteLabels from '../SatelliteLabels.jsx';
import ViewSettingsDrawer from './ViewSettingsDrawer.jsx';
import DataHealthPopover from '../crisis/popovers/DataHealthPopover.jsx';
import { Sliders } from 'lucide-react';

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

export default function WorldModeWorkspace({
  flightData,
  satelliteData,
  earthquakeData,
  shipData,
  viewer,
  satSelectFnRef,
  flightSelectFnRef,
  onLaunchIncidentCommand,
  onTriggerFloodSimulation,
  onResetSimulation,
  gemini: _gemini,
}) {
  const {
    showHUD,
    activeLayers,
    activePopover,
    closePopover,
  } = useWorldView();

  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [bloomEnabled, setBloomEnabled] = useState(false);
  const [sharpenValue, setSharpenValue] = useState(0);

  const sharpenStageRef = useRef(null);
  const bloomStageRef = useRef(null);

  // Rotation lock
  const handleToggleRotationLock = useCallback(() => {
    if (!viewer || viewer.isDestroyed?.()) return;
    const rotateEnabled = viewer.scene.screenSpaceCameraController.enableRotate;
    viewer.scene.screenSpaceCameraController.enableRotate = !rotateEnabled;
    setIsPanning(!rotateEnabled);
  }, [viewer]);

  // Bloom
  const handleToggleBloom = useCallback(() => {
    if (!viewer || viewer.isDestroyed?.()) return;
    if (bloomEnabled) {
      if (bloomStageRef.current) {
        try { viewer.scene.postProcessStages.remove(bloomStageRef.current); } catch (_e) {}
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

  // Sharpen
  const handleSharpenChange = useCallback((e) => {
    if (!viewer || viewer.isDestroyed?.()) return;
    const val = parseInt(e.target.value, 10);
    setSharpenValue(val);
    const intensity = val / 100;

    if (val === 0) {
      if (sharpenStageRef.current) {
        try { viewer.scene.postProcessStages.remove(sharpenStageRef.current); } catch (_e) {}
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

  // Screenshot
  const handleScreenshot = useCallback(() => {
    if (!viewer || viewer.isDestroyed?.()) return;
    viewer.render();
    const canvas = viewer.canvas;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `worldview-capture-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.warn('Screenshot failed:', e);
    }
  }, [viewer]);

  // Reset view
  const handleResetView = useCallback(() => {
    if (!viewer || viewer.isDestroyed?.()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(20, 20, 22000000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 2.2,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  }, [viewer]);

  useEffect(() => {
    return () => {
      if (viewer && !viewer.isDestroyed?.()) {
        if (sharpenStageRef.current) {
          try { viewer.scene.postProcessStages.remove(sharpenStageRef.current); } catch (_e) {}
        }
        if (bloomStageRef.current) {
          try { viewer.scene.postProcessStages.remove(bloomStageRef.current); } catch (_e) {}
        }
      }
    };
  }, [viewer]);

  return (
    <div className="world-mode-workspace-container" aria-label="World Situational Awareness Workspace">
      {/* Selective Satellite Floating Labels (Only Key Stations / Selected) */}
      {showHUD && activeLayers.satellites && (
        <SatelliteLabels
          viewer={viewer}
          satelliteData={satelliteData}
          onSatelliteClick={(name, tle1, tle2, lat, lon, alt) => {
            if (satSelectFnRef.current) satSelectFnRef.current(name, tle1, tle2, lat, lon, alt);
          }}
        />
      )}

      {/* Left Panel: Global Surveillance & Layer Controls */}
      {showHUD && (
        <aside className="left-panel">
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

      {/* Right Panel: Global Surveillance Telemetry & View Settings Trigger */}
      <aside className="right-panel">
        <VisualControlsPanel
          viewer={viewer}
          earthquakeData={earthquakeData}
          onDetectCrisis={onLaunchIncidentCommand}
          onSimulateFlood={onTriggerFloodSimulation}
          onResetSimulation={onResetSimulation}
          onOpenViewSettings={() => setIsViewSettingsOpen(true)}
        />
      </aside>

      {/* Floating View Settings Drawer */}
      <ViewSettingsDrawer
        isOpen={isViewSettingsOpen}
        onClose={() => setIsViewSettingsOpen(false)}
        viewer={viewer}
        bloomEnabled={bloomEnabled}
        onToggleBloom={handleToggleBloom}
        sharpenValue={sharpenValue}
        onSharpenChange={handleSharpenChange}
        isPanning={isPanning}
        onToggleRotationLock={handleToggleRotationLock}
        onScreenshot={handleScreenshot}
        onResetView={handleResetView}
      />

      {/* Contextual Popovers in World Mode */}
      {activePopover?.type === 'DATA_HEALTH' && (
        <DataHealthPopover onClose={closePopover} />
      )}
    </div>
  );
}
