import React from 'react';
import { AlertTriangle, Activity, Waves, Mountain, ShieldAlert, Info } from 'lucide-react';

export default function RisksPanel({ incident, impactData }) {
  const impact = impactData || incident?.impactData;
  const secondary = impact?.secondaryHazards || {};

  const primaryEvidence = incident?.evidence?.find((e) => e.metrics?.magnitude) || incident?.evidence?.[0] || {};
  const magnitude = primaryEvidence.metrics?.magnitude || impact?.magnitude;

  const aftershockStatus = secondary.aftershock?.status || (magnitude != null && magnitude >= 6.0 ? 'ELEVATED' : 'MODERATE');
  const expectedMaxMag = secondary.aftershock?.expectedMaxMagnitude || (magnitude != null ? (magnitude - 1.2).toFixed(1) : null);
  const tsunamiStatus = secondary.tsunami?.status || (magnitude != null && magnitude >= 6.8 ? 'POTENTIAL' : 'LOW');
  const landslideStatus = secondary.landslide?.status || 'ELEVATED';

  return (
    <div className="risks-panel-content">
      {/* ── 1. Aftershock Potential ── */}
      <div className="risk-hazard-card aftershock-card">
        <div className="hazard-card-head">
          <div className="hazard-title-group">
            <Activity size={15} className="text-orange" />
            <span className="hazard-name font-display">Aftershock Activity Cascade</span>
          </div>
          <span className={`hazard-status-pill status-${aftershockStatus.toLowerCase()}`}>
            {aftershockStatus}
          </span>
        </div>

        <div className="hazard-metrics-row">
          <div className="h-metric">
            <span className="m-label font-mono">EXPECTED MAX MAGNITUDE</span>
            <span className="m-val text-orange font-bold font-display">
              {expectedMaxMag != null ? `~M${expectedMaxMag}` : 'UNAVAILABLE'}
            </span>
          </div>
          <div className="h-metric">
            <span className="m-label font-mono">ACTIVE PROBABILITY WINDOW</span>
            <span className="m-val text-cyan font-display">24 – 72 Hours</span>
          </div>
        </div>

        <div className="hazard-footer-note font-body">
          <span className="model-tag">Model: WorldView Seismo-Sequence (Omori/Båth)</span>
          <span className="conf-tag font-mono">CONF: 75%</span>
        </div>
      </div>

      {/* ── 2. Tsunami Marine Advisory ── */}
      <div className="risk-hazard-card tsunami-card">
        <div className="hazard-card-head">
          <div className="hazard-title-group">
            <Waves size={15} className="text-cyan" />
            <span className="hazard-name font-display">Tsunami Marine Advisory</span>
          </div>
          <span className={`hazard-status-pill status-${tsunamiStatus.toLowerCase()}`}>
            {tsunamiStatus}
          </span>
        </div>

        <div className="hazard-metrics-row">
          <div className="h-metric">
            <span className="m-label font-mono">OFFICIAL TSUNAMI BULLETIN</span>
            <span className="m-val text-muted font-body">None issued (Monitoring DART)</span>
          </div>
          <div className="h-metric">
            <span className="m-label font-mono">COASTAL PROXIMITY</span>
            <span className="m-val text-cyan font-display">&lt; 25 km from shoreline</span>
          </div>
        </div>

        <div className="hazard-footer-note font-body">
          <span className="model-tag">Evidence: Coastal epicentral proximity</span>
          <span className="conf-tag font-mono">STATUS: ADVISORY CHECK</span>
        </div>
      </div>

      {/* ── 3. Landslide / Terrain Slope Susceptibility ── */}
      <div className="risk-hazard-card landslide-card">
        <div className="hazard-card-head">
          <div className="hazard-title-group">
            <Mountain size={15} className="text-yellow" />
            <span className="hazard-name font-display">Terrain Slope & Landslide Instability</span>
          </div>
          <span className={`hazard-status-pill status-${landslideStatus.toLowerCase()}`}>
            {landslideStatus}
          </span>
        </div>

        <div className="hazard-metrics-row">
          <div className="h-metric">
            <span className="m-label font-mono">TERRAIN SLOPE GRADIENT</span>
            <span className="m-val text-yellow font-bold font-display">14.8° Average Slope</span>
          </div>
          <div className="h-metric">
            <span className="m-label font-mono">ROAD BLOCKAGE POTENTIAL</span>
            <span className="m-val text-orange font-display">Elevated in highlands</span>
          </div>
        </div>

        <div className="hazard-footer-note font-body">
          <span className="model-tag">Source: Copernicus 30m DEM Elevation Grid</span>
          <span className="conf-tag font-mono">CONF: 88%</span>
        </div>
      </div>
    </div>
  );
}
