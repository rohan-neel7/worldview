import React, { useState, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

// Key strategic space assets to label selectively
const KEY_ASSETS = ['ISS (ZARYA)', 'TIANGONG', 'HST', 'CSS (TIANHE)'];

export default function SatelliteLabels({ viewer, satelliteData, onSatelliteClick, selectedSatelliteName }) {
  const [labels, setLabels] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed?.() || !satelliteData?.length) {
      setLabels([]);
      return;
    }

    const computeLabels = () => {
      if (!viewer || viewer.isDestroyed()) return;
      const canvas = viewer.scene.canvas;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();

      const filtered = satelliteData.filter((s) => {
        if (!s.name) return false;
        if (selectedSatelliteName && s.name === selectedSatelliteName) return true;
        return KEY_ASSETS.some((k) => s.name.toUpperCase().includes(k));
      });

      const nextLabels = [];
      for (const sat of filtered.slice(0, 3)) {
        if (sat.lon == null || sat.lat == null) continue;
        try {
          const cartesian = Cesium.Cartesian3.fromDegrees(sat.lon, sat.lat, (sat.alt || 400) * 1000);
          const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian);
          if (!screenPos) continue;

          const winX = screenPos.x + canvasRect.left;
          const winY = screenPos.y + canvasRect.top;

          nextLabels.push({
            id: sat.name.replace(/\s*\(.*\)/, ''),
            fullName: sat.name,
            x: winX,
            y: winY,
            satData: sat,
            isSelected: selectedSatelliteName === sat.name,
          });
        } catch (_e) {}
      }

      setLabels(nextLabels);
    };

    computeLabels();
    intervalRef.current = setInterval(computeLabels, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [viewer, satelliteData, selectedSatelliteName]);

  const handleLabelClick = (label) => {
    if (!onSatelliteClick || !label.satData) return;
    const sat = label.satData;
    onSatelliteClick(sat.name, sat.tle1, sat.tle2, sat.lat, sat.lon, sat.alt || 400);
  };

  if (labels.length === 0) return null;

  return (
    <div className="satellite-labels-container" style={{ pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 50 }}>
      {labels.map((label) => (
        <button
          key={label.fullName}
          type="button"
          aria-label={`Select satellite ${label.id}`}
          className={`satellite-label ${label.isSelected ? 'selected' : ''}`}
          style={{
            position: 'absolute',
            left: `${label.x + 8}px`,
            top: `${label.y - 12}px`,
            pointerEvents: 'auto',
            background: 'rgba(5, 10, 18, 0.85)',
            border: `1px solid ${label.isSelected ? 'var(--color-amber)' : 'rgba(255, 215, 0, 0.4)'}`,
            borderRadius: '3px',
            padding: '1px 6px',
            cursor: 'pointer',
            color: 'var(--color-amber)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.05em',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            transform: 'translateY(-50%)',
          }}
          onClick={() => handleLabelClick(label)}
        >
          <span>{label.id}</span>
        </button>
      ))}
    </div>
  );
}
