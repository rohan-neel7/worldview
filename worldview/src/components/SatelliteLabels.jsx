import { useState, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

const UPDATE_INTERVAL_MS = 5_000;
const MAX_LABELS = 15;

export default function SatelliteLabels({ viewer, satelliteData, onSatelliteClick }) {
  const [labels, setLabels] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed?.() || !satelliteData?.length) {
      setLabels([]);
      return;
    }

    const computeLabels = () => {
      if (!viewer || viewer.isDestroyed()) return;
      const viewport = document.querySelector('.globe-wrapper');
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const r = rect.width / 2;
      if (r <= 0) return;

      const canvas = viewer.scene.canvas;
      const canvasRect = canvas.getBoundingClientRect();

      const INNER_RATIO = 0.20;
      const OUTER_RATIO = 1.30;
      const LABEL_RATIO = 1.15;

      const candidates = [];
      for (const sat of satelliteData) {
        if (sat.lon == null || sat.lat == null) continue;
        try {
          const cartesian = Cesium.Cartesian3.fromDegrees(sat.lon, sat.lat, (sat.alt || 400) * 1000);
          const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian);
          if (!screenPos) continue;

          const winX = screenPos.x + canvasRect.left;
          const winY = screenPos.y + canvasRect.top;
          const dx = winX - cx;
          const dy = winY - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ratio = dist / r;

          if (ratio < INNER_RATIO || ratio > OUTER_RATIO) continue;
          candidates.push({
            sat,
            dx, dy,
            angle: Math.atan2(dy, dx),
            edgeScore: 1 - Math.abs(ratio - 1.0),
          });
        } catch {}
      }

      candidates.sort((a, b) => b.edgeScore - a.edgeScore);
      const selected = candidates.slice(0, MAX_LABELS);
      const usedAngles = [];
      const MIN_ANGLE_GAP = 0.15;
      const finalLabels = [];

      for (const c of selected) {
        if (usedAngles.some(a => Math.abs(angleDiff(a, c.angle)) < MIN_ANGLE_GAP)) continue;
        usedAngles.push(c.angle);
        const labelX = cx + Math.cos(c.angle) * r * LABEL_RATIO;
        const labelY = cy + Math.sin(c.angle) * r * LABEL_RATIO;
        finalLabels.push({
          id: formatSatId(c.sat.name),
          x: labelX,
          y: labelY,
          opacity: 0.5 + c.edgeScore * 0.4,
          // Store original satellite data for click handler
          satData: c.sat,
        });
      }
      setLabels(finalLabels);
    };

    const startTimer = setTimeout(computeLabels, 2000);
    intervalRef.current = setInterval(computeLabels, UPDATE_INTERVAL_MS);
    return () => {
      clearTimeout(startTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [viewer, satelliteData]);

  const handleLabelClick = (label) => {
    if (!onSatelliteClick || !label.satData) return;
    const sat = label.satData;
    onSatelliteClick(sat.name, sat.tle1, sat.tle2, sat.lat, sat.lon, sat.alt || 400);
  };

  if (labels.length === 0) return null;

  return (
    <div className="satellite-labels-container">
      {labels.map((label) => (
        <button
          key={label.id}
          type="button"
          aria-label={`Select satellite ${label.id}`}
          className={`satellite-label glow-text-amber ${onSatelliteClick ? 'clickable' : ''}`}
          style={{
            left: `${label.x}px`,
            top: `${label.y}px`,
            opacity: label.opacity,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
            font: 'inherit',
            outline: 'none'
          }}
          onClick={() => handleLabelClick(label)}
        >
          {label.id}
        </button>
      ))}
    </div>
  );
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function formatSatId(name) {
  if (!name) return 'SAT-00000';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return `SAT-${String(Math.abs(hash) % 100000).padStart(5, '0')}`;
}
