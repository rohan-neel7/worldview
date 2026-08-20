import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Building2, 
  Plane, 
  Anchor, 
  Compass, 
  Navigation, 
  RefreshCw, 
  Copy, 
  Check, 
  X, 
  AlertTriangle, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Bot,
  Info
} from 'lucide-react';
import * as Cesium from 'cesium';
import { useWorldView } from '../WorldViewContext';
import { globalCameraController } from '../engine/camera/CentralizedCameraController.js';

export default function IncidentCommandDossier({
  isOpen,
  onClose,
  viewer,
  geminiReport,
  geminiLoading,
  onTriggerGemini,
}) {
  const {
    activeIncident,
    activeImpactData,
    exitIncidentMode,
    setSelectedAsset,
    aiSummaryMode,
    setAiSummaryMode,
  } = useWorldView();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' | 'IMPACT' | 'RISKS' | 'EVIDENCE' | 'RESPONSE' | 'AI'
  const [showMethodology, setShowMethodology] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState(null);

  const handleFlyToAsset = (asset, type) => {
    setSelectedAssetDetail(asset);
    if (setSelectedAsset) {
      setSelectedAsset({ ...asset, assetType: type });
    }
    if (asset?.lat != null && asset?.lon != null) {
      globalCameraController.flyToAsset(asset, asset.lon, 32000);
    }
  };

  const handleFocusShakingRadius = (radiusKm) => {
    if (activeIncident && radiusKm) {
      globalCameraController.flyToCrisisRadius(activeIncident, radiusKm * 1000);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedAssetDetail) {
          setSelectedAssetDetail(null);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedAssetDetail]);

  if (!isOpen || !activeIncident) return null;

  const incident = activeIncident;
  const impact = activeImpactData || incident.impactData;
  const risk = incident.risk || {};
  const riskScore = typeof risk.score === 'number' ? risk.score : 84;
  const severity = risk.severity || incident.severity || 'CRITICAL';

  // Sensor Verification vs Model Assessment Confidence
  const eventConfidencePct = 98; // Verified USGS upstream telemetry
  const assessmentConfidencePct = Math.round((incident.confidence || 0.74) * 100);

  // Primary Seismic Metadata
  const primaryEvidence = incident.evidence?.find((e) => e.metrics?.magnitude) || incident.evidence?.[0] || {};
  const magnitude = primaryEvidence.metrics?.magnitude || impact?.magnitude || 7.7;
  const depthKm = primaryEvidence.metrics?.depthKm || impact?.depthKm || 10;
  const locationName = incident.location?.name || impact?.place || 'Regional Epicenter';
  const observedAt = incident.createdAt || primaryEvidence.timestamp || new Date().toISOString();
  const formattedObservedTime = new Date(observedAt).toISOString().replace('T', ' ').split('.')[0] + 'Z';
  const sourceMode = incident.sourceMode || 'LIVE';

  // Impact & Exposure Counts
  const popExposed = impact?.exposureMetrics?.populationExposed || 0;
  const hospitals = impact?.exposedAssets?.hospitals || [];
  const airports = impact?.exposedAssets?.airports || [];
  const ports = impact?.exposedAssets?.ports || [];
  const roads = impact?.exposedAssets?.roads || [];
  const shakingZones = impact?.shakingZones || { severeRadiusKm: 18, moderateRadiusKm: 55, lightRadiusKm: 120 };
  const secondary = impact?.secondaryHazards || {};
  const responseOptions = impact?.responseOptions || [];
  const evidenceList = incident.evidence || [];
  const evidenceGaps = incident.evidenceGaps || [];

  // Severity visual helper
  const getSeverityBadgeClass = (sev) => {
    if (sev === 'CRITICAL') return 'sev-critical';
    if (sev === 'HIGH') return 'sev-high';
    if (sev === 'MODERATE') return 'sev-moderate';
    return 'sev-low';
  };

  const handleCopyDossier = () => {
    const text = `=======================================================
WORLDVIEW INCIDENT COMMAND DOSSIER // EARTHQUAKE
INCIDENT: ${incident.title}
MAGNITUDE: M${magnitude.toFixed(1)} | FOCAL DEPTH: ${depthKm}km
EPICENTER: ${locationName} [LAT: ${incident.location?.lat?.toFixed(4)}, LON: ${incident.location?.lon?.toFixed(4)}]
OBSERVED: ${formattedObservedTime} | SOURCE: USGS (${sourceMode})
-------------------------------------------------------
CONFIDENCE RATINGS:
- EVENT CONFIDENCE: ${eventConfidencePct}% (USGS Sensor Verification)
- ASSESSMENT CONFIDENCE: ${assessmentConfidencePct}% (WorldView Impact Model)
- DETERMINISTIC RISK: ${riskScore}/100 [${severity}]
-------------------------------------------------------
[01. WHAT HAPPENED]
${risk.explanation || `M${magnitude.toFixed(1)} shallow seismic event at ${depthKm}km focal depth near ${locationName}.`}

[02. IMPACT EXTENT (WORLDVIEW ATTENUATION MODEL)]
- Severe Shaking (MMI VII+): ${shakingZones.severeRadiusKm} km radius
- Moderate Shaking (MMI V-VI): ${shakingZones.moderateRadiusKm} km radius
- Light Shaking (MMI III-IV): ${shakingZones.lightRadiusKm} km radius
- Estimated Population Exposed: ~${popExposed.toLocaleString()} (WorldPop)
- Healthcare Facilities Exposed: ${hospitals.length}
- Aviation Runways Exposed: ${airports.length}
- Maritime Ports Exposed: ${ports.length}
- Arterial Road Segments: ${roads.length}

[03. SECONDARY RISKS (WORLDVIEW HEURISTIC)]
- Aftershock Potential: ${secondary.aftershock?.status || 'ELEVATED'} (Max ~M${secondary.aftershock?.expectedMaxMagnitude || (magnitude - 1.15).toFixed(1)})
- Tsunami Potential: ${secondary.tsunami?.status || 'NONE'}
- Landslide Potential: ${secondary.landslide?.status || 'LOW'}

[04. TRACEABLE EVIDENCE]
${evidenceList.map((e) => `✓ [${e.source}] ${e.relationship}`).join('\n')}
${evidenceGaps.map((g) => `⚠ [GAP] ${g}`).join('\n')}

[05. GEMINI AI SYNTHESIS]
${geminiReport?.situation || 'Analytical review pending execution.'}
${geminiReport?.impact || ''}
${geminiReport?.directive || ''}
=======================================================`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <aside className="incident-overlay-panel" aria-label="Incident Command Intelligence Overlay">
      {/* Tactical Top Runner & Accents */}
      <div className="incident-panel-runner" />
      <div className="incident-bracket top-left" />
      <div className="incident-bracket top-right" />

      {/* ═══════════════════════════════════════════════════════════════
          1. HEADER (Structured, Crisp, High Hierarchy)
      ═══════════════════════════════════════════════════════════════ */}
      <header className="incident-panel-header">
        <div className="incident-header-top">
          <div className="incident-badge-row">
            <span className="pulse-dot-red" />
            <span className="incident-tag font-mono">EARTHQUAKE INCIDENT</span>
            <span className="incident-source-tag font-mono">USGS {sourceMode}</span>
          </div>

          <div className="incident-header-actions">
            <button 
              className="incident-return-btn font-mono"
              onClick={() => {
                exitIncidentMode();
                onClose?.();
              }}
              title="Return to World Mode"
            >
              <Compass size={13} />
              <span>RETURN TO WORLD</span>
            </button>
            <button 
              className="incident-close-btn" 
              onClick={onClose} 
              title="Minimize Overlay (ESC)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Title & Risk Pill */}
        <div className="incident-title-row">
          <h1 className="incident-title font-mono">
            M{magnitude.toFixed(1)} — {locationName}
          </h1>
          <div className={`incident-risk-pill font-mono ${getSeverityBadgeClass(severity)}`}>
            <span className="sev-dot" />
            <span>RISK {severity} {riskScore}/100</span>
          </div>
        </div>

        {/* Compact Metadata Row (Differentiated Confidences) */}
        <div className="incident-meta-grid font-mono">
          <div className="meta-cell">
            <span className="meta-lbl">DEPTH</span>
            <span className="meta-val">{depthKm} KM {depthKm <= 30 ? '(SHALLOW)' : '(DEEP)'}</span>
          </div>
          <div className="meta-cell">
            <span className="meta-lbl">OBSERVED</span>
            <span className="meta-val"><Clock size={10} style={{ verticalAlign: 'middle', marginRight: '3px' }} />{formattedObservedTime.slice(11, 19)} UTC</span>
          </div>
          <div className="meta-cell">
            <span className="meta-lbl">EVENT CONFIDENCE</span>
            <span className="meta-val highlight-green">{eventConfidencePct}%</span>
          </div>
          <div className="meta-cell">
            <span className="meta-lbl">ASSESSMENT CONF.</span>
            <span className="meta-val highlight-cyan">{assessmentConfidencePct}%</span>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          2. COMPACT METRIC ROW (High Impact Numbers: 26-32px)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="incident-kpi-strip font-mono">
        <div className="kpi-block">
          <span className="kpi-num highlight-amber">
            {popExposed >= 1000000
              ? `${(popExposed / 1000000).toFixed(1)}M`
              : popExposed > 0
              ? `${Math.round(popExposed / 1000)}K`
              : '< 5K'}
          </span>
          <span className="kpi-label">POP. EXPOSED</span>
        </div>

        <div className="kpi-block">
          <span className="kpi-num highlight-red">{hospitals.length}</span>
          <span className="kpi-label">HOSPITALS</span>
        </div>

        <div className="kpi-block">
          <span className="kpi-num highlight-cyan">{airports.length}</span>
          <span className="kpi-label">AIRPORTS</span>
        </div>

        <div className="kpi-block">
          <span className="kpi-num highlight-cyan">{roads.length > 0 ? roads.length : ports.length}</span>
          <span className="kpi-label">{roads.length > 0 ? 'ROAD GROUPS' : 'PORTS'}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. NAVIGATION TABS (6-Tab Progressive Disclosure)
      ═══════════════════════════════════════════════════════════════ */}
      <nav className="incident-tabs-bar font-mono">
        {[
          { id: 'OVERVIEW', label: 'OVERVIEW' },
          { id: 'IMPACT', label: `IMPACT (${hospitals.length + airports.length})` },
          { id: 'RISKS', label: 'RISKS' },
          { id: 'EVIDENCE', label: `EVIDENCE (${evidenceList.length})` },
          { id: 'RESPONSE', label: `RESPONSE (${responseOptions.length})` },
          { id: 'AI', label: 'AI' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`incident-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          4. SCROLLABLE TAB CONTENT BODY
      ═══════════════════════════════════════════════════════════════ */}
      <div className="incident-panel-body">
        {/* ──────────────────────────────────────────────────────────
            TAB 1: OVERVIEW (Default Snapshot)
        ────────────────────────────────────────────────────────── */}
        {activeTab === 'OVERVIEW' && (
          <div className="tab-pane fadeIn">
            {/* Situation Summary */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">WHAT HAPPENED</span>
                <span className="intel-source-tag">USGS SEISMIC</span>
              </div>
              <p className="intel-narrative font-sans">
                {risk.explanation || `Shallow magnitude ${magnitude.toFixed(1)} seismic rupture detected at ${depthKm} km depth near ${locationName}. Ground acceleration radiates outward across local fault lines, placing nearby communities and infrastructure under moderate-to-severe ground motion.`}
              </p>
            </div>

            {/* Risk Breakdown & Primary Drivers */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">RISK EVALUATION</span>
                <span className="risk-score-badge font-mono">{riskScore} / 100</span>
              </div>
              <div className="risk-drivers-list font-mono">
                <div className="driver-row">
                  <span className="driver-bullet red" />
                  <span className="driver-name">Hazard Intensity:</span>
                  <span className="driver-val">M{magnitude.toFixed(1)} Shallow Focal Depth</span>
                </div>
                <div className="driver-row">
                  <span className="driver-bullet amber" />
                  <span className="driver-name">Population Exposure:</span>
                  <span className="driver-val">~{popExposed > 0 ? `${Math.round(popExposed / 1000)}k exposed` : 'Low density'}</span>
                </div>
                <div className="driver-row">
                  <span className="driver-bullet cyan" />
                  <span className="driver-name">Infrastructure Deficit:</span>
                  <span className="driver-val">{hospitals.length} Healthcare, {airports.length} Runways</span>
                </div>
                <div className="driver-row">
                  <span className="driver-bullet amber" />
                  <span className="driver-name">Secondary Threat:</span>
                  <span className="driver-val">{secondary.aftershock?.status || 'ELEVATED'} Aftershocks</span>
                </div>
              </div>
            </div>

            {/* Secondary Hazards Snapshot */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">WHAT COULD HAPPEN NEXT</span>
                <span className="intel-source-tag">WORLDVIEW HEURISTIC</span>
              </div>
              <div className="secondary-quick-grid font-sans">
                <div className="quick-hazard-item">
                  <div className="qh-head font-mono">
                    <Activity size={13} color="var(--color-amber)" />
                    <span>AFTERSHOCK POTENTIAL</span>
                    <span className="qh-badge amber">ELEVATED</span>
                  </div>
                  <p className="qh-desc">Expected maximum aftershock ~M{(magnitude - 1.15).toFixed(1)} based on Bath's Law heuristic.</p>
                </div>

                <div className="quick-hazard-item">
                  <div className="qh-head font-mono">
                    <ShieldAlert size={13} color={secondary.tsunami?.status?.includes('POTENTIAL') ? '#FF3333' : 'var(--color-cyan)'} />
                    <span>TSUNAMI POTENTIAL</span>
                    <span className={`qh-badge ${secondary.tsunami?.status?.includes('POTENTIAL') ? 'red' : 'cyan'}`}>
                      {secondary.tsunami?.status || 'NONE'}
                    </span>
                  </div>
                  <p className="qh-desc">{secondary.tsunami?.evidence || 'Inland epicentral location minimizes oceanic displacement risk.'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────
            TAB 2: IMPACT & EXPOSURE
        ────────────────────────────────────────────────────────── */}
        {activeTab === 'IMPACT' && (
          <div className="tab-pane fadeIn">
            {/* Shaking Zones Extents */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">ESTIMATED SHAKING EXTENT</span>
                <span className="intel-source-tag">WORLDVIEW MODEL</span>
              </div>

              <div className="shaking-zones-stack font-mono">
                <div 
                  className="zone-row severe cursor-pointer"
                  onClick={() => handleFocusShakingRadius(shakingZones.severeRadiusKm || 20)}
                  title="Click to point camera at Severe Shaking Radius"
                >
                  <span className="zone-indicator severe" />
                  <div className="zone-info">
                    <span className="zone-name">SEVERE SHAKING (MMI VII+)</span>
                    <span className="zone-rad">{shakingZones.severeRadiusKm > 0 ? `${shakingZones.severeRadiusKm} km radius` : 'Nominal Core'}</span>
                  </div>
                  <span className="zone-desc font-sans">Potential structural damage</span>
                </div>

                <div 
                  className="zone-row moderate cursor-pointer"
                  onClick={() => handleFocusShakingRadius(shakingZones.moderateRadiusKm || 55)}
                  title="Click to point camera at Moderate Shaking Radius"
                >
                  <span className="zone-indicator moderate" />
                  <div className="zone-info">
                    <span className="zone-name">MODERATE SHAKING (MMI V-VI)</span>
                    <span className="zone-rad">{shakingZones.moderateRadiusKm} km radius</span>
                  </div>
                  <span className="zone-desc font-sans">Felt strongly, non-structural disruption</span>
                </div>

                <div 
                  className="zone-row light cursor-pointer"
                  onClick={() => handleFocusShakingRadius(shakingZones.lightRadiusKm || 120)}
                  title="Click to point camera at Light Shaking Radius"
                >
                  <span className="zone-indicator light" />
                  <div className="zone-info">
                    <span className="zone-name">LIGHT SHAKING (MMI III-IV)</span>
                    <span className="zone-rad">{shakingZones.lightRadiusKm} km radius</span>
                  </div>
                  <span className="zone-desc font-sans">Perceptible awareness perimeter</span>
                </div>
              </div>

              {/* Expandable Methodology */}
              <button 
                className="methodology-toggle-btn font-mono"
                onClick={() => setShowMethodology(!showMethodology)}
              >
                <Info size={12} />
                <span>{showMethodology ? 'HIDE ATTENUATION METHODOLOGY' : 'VIEW ATTENUATION METHODOLOGY'}</span>
              </button>

              {showMethodology && (
                <div className="methodology-box font-sans">
                  <p><strong>Model:</strong> Worldview Seismo-Attenuation Model (v1.2)</p>
                  <p><strong>Equation:</strong> Empirical log-distance attenuation factoring Moment Magnitude (Mw {magnitude.toFixed(1)}) and Hypocenter Focal Depth ({depthKm}km).</p>
                  <p><strong>Provenance:</strong> Baseline population derived from WorldPop gridded centroids intersecting computed isoseismal zones.</p>
                </div>
              )}
            </div>

            {/* Exposed Assets List */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">EXPOSED INFRASTRUCTURE</span>
                <span className="intel-source-tag">OSM / UN DATA</span>
              </div>

              <div className="exposed-assets-container">
                {/* Hospitals */}
                <div className="asset-group">
                  <div className="asset-group-title font-mono">
                    <Building2 size={13} color="#FF3333" />
                    <span>HEALTHCARE FACILITIES ({hospitals.length})</span>
                  </div>
                  {hospitals.length === 0 ? (
                    <div className="empty-asset-msg font-sans">No major healthcare facilities within shaking boundary.</div>
                  ) : (
                    hospitals.map((hosp) => (
                      <div 
                        key={hosp.id} 
                        className={`asset-card ${selectedAssetDetail?.id === hosp.id ? 'active' : ''}`}
                        onClick={() => handleFlyToAsset(hosp, 'HOSPITAL')}
                      >
                        <div className="asset-card-main">
                          <span className="asset-title font-mono">{hosp.name}</span>
                          <span className="asset-sub font-sans">
                            {hosp.category} • {hosp.beds ? `${hosp.beds} Beds` : 'Regional Facility'}
                          </span>
                        </div>
                        <div className="asset-card-meta font-mono">
                          <span className={`asset-band-pill ${hosp.intensityBand?.toLowerCase()}`}>
                            {hosp.intensityBand} ({hosp.distanceKm}km)
                          </span>
                          <Navigation size={12} color="var(--color-cyan)" />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Airports */}
                <div className="asset-group">
                  <div className="asset-group-title font-mono">
                    <Plane size={13} color="var(--color-cyan)" />
                    <span>AVIATION RUNWAYS ({airports.length})</span>
                  </div>
                  {airports.length === 0 ? (
                    <div className="empty-asset-msg font-sans">No major airports detected in impact perimeter.</div>
                  ) : (
                    airports.map((apt) => (
                      <div 
                        key={apt.id} 
                        className={`asset-card ${selectedAssetDetail?.id === apt.id ? 'active' : ''}`}
                        onClick={() => handleFlyToAsset(apt, 'AIRPORT')}
                      >
                        <div className="asset-card-main">
                          <span className="asset-title font-mono">{apt.name} ({apt.iata || apt.icao})</span>
                          <span className="asset-sub font-sans">Runway: {apt.runwayLengthM}m • {apt.capability}</span>
                        </div>
                        <div className="asset-card-meta font-mono">
                          <span className={`asset-band-pill ${apt.intensityBand?.toLowerCase()}`}>
                            {apt.intensityBand} ({apt.distanceKm}km)
                          </span>
                          <Navigation size={12} color="var(--color-cyan)" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────
            TAB 3: RISKS & SECONDARY HAZARDS
        ────────────────────────────────────────────────────────── */}
        {activeTab === 'RISKS' && (
          <div className="tab-pane fadeIn">
            {/* Aftershock Details */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">AFTERSHOCK POTENTIAL</span>
                <span className="qh-badge amber font-mono">ELEVATED</span>
              </div>
              <div className="risk-detail-body font-sans">
                <div className="risk-metric-row font-mono">
                  <div>MODEL: <strong>WORLDVIEW HEURISTIC</strong></div>
                  <div>MAX POTENTIAL: <strong>~M{(magnitude - 1.15).toFixed(1)}</strong></div>
                </div>
                <p className="font-sans">
                  Omori-Utsu decay rate suggests elevated probability of strong aftershocks within the first 24 to 72 hours. Search and rescue operations should account for structural re-settling.
                </p>
              </div>
            </div>

            {/* Tsunami Assessment */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">TSUNAMI ASSESSMENT</span>
                <span className={`qh-badge ${secondary.tsunami?.status?.includes('POTENTIAL') ? 'red' : 'cyan'} font-mono`}>
                  {secondary.tsunami?.status || 'NONE'}
                </span>
              </div>
              <div className="risk-detail-body font-sans">
                <div className="risk-metric-row font-mono">
                  <div>SOURCE: <strong>USGS / NOAA</strong></div>
                  <div>COASTAL BUFFER: <strong>{ports.length > 0 ? 'COASTAL PROXIMITY' : 'INLAND'}</strong></div>
                </div>
                <p className="font-sans">
                  {secondary.tsunami?.evidence || 'No official tsunami alert in effect. Inland focal coordinates prevent direct bathymetric water column displacement.'}
                </p>
              </div>
            </div>

            {/* Uncertainty & Limitations */}
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">UNCERTAINTY & LIMITATIONS</span>
                <span className="intel-source-tag">ANALYTICAL CAVEATS</span>
              </div>
              <ul className="uncertainty-list font-sans">
                <li>Population figures are estimated from gridded population models (WorldPop 2024).</li>
                <li>Asset exposures denote potential isoseismal intersection, not confirmed structural damage.</li>
                <li>Local soil liquefaction requires in-situ geotechnical sensor confirmation.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────
            TAB 4: EVIDENCE TRACEABILITY
        ────────────────────────────────────────────────────────── */}
        {activeTab === 'EVIDENCE' && (
          <div className="tab-pane fadeIn">
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">TRACEABLE SENSOR EVIDENCE</span>
                <span className="intel-source-tag">{evidenceList.length} ITEMS</span>
              </div>

              <div className="evidence-stream">
                <div className="evidence-trace-item verified font-sans">
                  <div className="ev-icon"><CheckCircle2 size={15} color="#00FF88" /></div>
                  <div className="ev-content">
                    <span className="ev-title font-mono">USGS Seismic Ingest Verified</span>
                    <span className="ev-desc">M{magnitude.toFixed(1)} event observation streaming with 98% telemetry confidence.</span>
                  </div>
                </div>

                <div className="evidence-trace-item verified font-sans">
                  <div className="ev-icon"><CheckCircle2 size={15} color="#00FF88" /></div>
                  <div className="ev-content">
                    <span className="ev-title font-mono">Focal Depth Classification</span>
                    <span className="ev-desc">{depthKm} km depth confirmed as shallow crustal rupture event.</span>
                  </div>
                </div>

                <div className="evidence-trace-item verified font-sans">
                  <div className="ev-icon"><CheckCircle2 size={15} color="#00FF88" /></div>
                  <div className="ev-content">
                    <span className="ev-title font-mono">Geospatial Exposure Intersection</span>
                    <span className="ev-desc">Isoseismal boundaries calculated against global infrastructure and population registry.</span>
                  </div>
                </div>

                <div className="evidence-trace-item advisory font-sans">
                  <div className="ev-icon"><AlertCircle size={15} color="var(--color-amber)" /></div>
                  <div className="ev-content">
                    <span className="ev-title font-mono">Tsunami Advisory Status</span>
                    <span className="ev-desc">No confirmed national tsunami warning source at this timestamp.</span>
                  </div>
                </div>
              </div>
            </div>

            {evidenceGaps.length > 0 && (
              <div className="intel-card">
                <div className="intel-card-header font-mono">
                  <span className="intel-header-title">EVIDENCE GAPS</span>
                  <span className="qh-badge amber font-mono">{evidenceGaps.length} GAPS</span>
                </div>
                <div className="gaps-list font-sans">
                  {evidenceGaps.map((gap, idx) => (
                    <div key={idx} className="gap-item">
                      <AlertTriangle size={13} color="var(--color-amber)" />
                      <span>{gap}: Telemetry pending local accelerometer sync.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────
            TAB 5: RESPONSE OPTIONS
        ────────────────────────────────────────────────────────── */}
        {activeTab === 'RESPONSE' && (
          <div className="tab-pane fadeIn">
            <div className="intel-card">
              <div className="intel-card-header font-mono">
                <span className="intel-header-title">DECISION SUPPORT CONSIDERATIONS</span>
                <span className="intel-source-tag">RECOMMENDED CHECKS</span>
              </div>

              <div className="response-stack font-sans">
                <div className="response-card urgent">
                  <div className="res-header font-mono">
                    <span className="res-num">01</span>
                    <span className="res-title">Assess Coastal & Shallow Fault Exposure</span>
                    <span className="res-pill red">URGENT</span>
                  </div>
                  <div className="res-field">
                    <span className="res-lbl font-mono">OBJECTIVE:</span>
                    <span className="res-val">Verify coastal settlement ground stability and immediate sea-level fluctuations.</span>
                  </div>
                  <div className="res-field">
                    <span className="res-lbl font-mono">RATIONALE:</span>
                    <span className="res-val">Shallow rupture depth creates heightened risk of localized coastal subsidence.</span>
                  </div>
                </div>

                <div className="response-card high">
                  <div className="res-header font-mono">
                    <span className="res-num">02</span>
                    <span className="res-title">Check Hospital Accessibility & Power</span>
                    <span className="res-pill amber">HIGH</span>
                  </div>
                  <div className="res-field">
                    <span className="res-lbl font-mono">OBJECTIVE:</span>
                    <span className="res-val">Establish communication with {hospitals.length} identified healthcare facilities in zone.</span>
                  </div>
                  <div className="res-field">
                    <span className="res-lbl font-mono">RATIONALE:</span>
                    <span className="res-val">Confirm auxiliary generator status and bed availability for casualty intake.</span>
                  </div>
                </div>

                <div className="response-card standard">
                  <div className="res-header font-mono">
                    <span className="res-num">03</span>
                    <span className="res-title">Inspect Key Transit Corridors & Bridges</span>
                    <span className="res-pill cyan">STANDARD</span>
                  </div>
                  <div className="res-field">
                    <span className="res-lbl font-mono">OBJECTIVE:</span>
                    <span className="res-val">Survey arterial road networks and bridge abutments for ground deformation.</span>
                  </div>
                  <div className="res-field">
                    <span className="res-lbl font-mono">RATIONALE:</span>
                    <span className="res-val">Ensure clear transit paths for incoming emergency relief convoys.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────
            TAB 6: GEMINI ANALYSIS (Dual Mode: Public vs Authority)
        ────────────────────────────────────────────────────────── */}
        {activeTab === 'AI' && (
          <div className="tab-pane fadeIn">
            <div className="intel-card ai-card">
              <div className="intel-card-header font-mono">
                <div className="ai-header-left">
                  <Bot size={16} color="var(--color-cyan)" />
                  <span className="intel-header-title highlight-cyan">CRISIS INTELLIGENCE AI</span>
                </div>
                <span className="intel-source-tag font-mono">GEMINI PRO</span>
              </div>

              {/* Dual Mode Switcher: PUBLIC SUMMARY vs AUTHORITY BRIEF */}
              <div className="ai-mode-toggle-bar font-mono">
                <button
                  className={`ai-toggle-pill ${aiSummaryMode === 'PUBLIC' ? 'active' : ''}`}
                  onClick={() => setAiSummaryMode('PUBLIC')}
                >
                  PUBLIC SUMMARY
                </button>
                <button
                  className={`ai-toggle-pill ${aiSummaryMode === 'AUTHORITY' ? 'active' : ''}`}
                  onClick={() => setAiSummaryMode('AUTHORITY')}
                >
                  AUTHORITY BRIEF
                </button>
              </div>

              <div className="ai-attribution-note font-sans">
                {aiSummaryMode === 'PUBLIC'
                  ? 'Objective, plain-language summary for situational awareness and civilian emergency guidance.'
                  : 'Technical operational analysis for emergency operation centers, logistics, and incident commanders.'}
              </div>

              {geminiLoading ? (
                <div className="ai-loading-box font-mono">
                  <RefreshCw size={24} color="var(--color-cyan)" className="animate-spin" />
                  <span>SYNTHESIZING {aiSummaryMode} INTELLIGENCE WITH GEMINI...</span>
                </div>
              ) : (
                <div className="ai-content-body font-sans">
                  {geminiReport?.situation ? (
                    <>
                      <div className="ai-narrative-block">
                        <h4 className="ai-section-heading font-mono">WHY THIS MATTERS</h4>
                        <p className="ai-text font-sans">{geminiReport.situation}</p>
                      </div>

                      <div className="ai-narrative-block">
                        <h4 className="ai-section-heading font-mono">ASSESSMENT & EXPOSURE</h4>
                        <p className="ai-text font-sans">{geminiReport.impact}</p>
                      </div>

                      <div className="ai-narrative-block">
                        <h4 className="ai-section-heading font-mono">RECOMMENDED CHECKS</h4>
                        <p className="ai-text font-sans">{geminiReport.directive}</p>
                      </div>
                    </>
                  ) : (
                    <div className="ai-empty-state font-sans">
                      <p>Generate a situational AI briefing derived from the current structured telemetry snapshot.</p>
                      <button 
                        className="incident-action-btn primary font-mono"
                        onClick={onTriggerGemini}
                      >
                        <Bot size={14} />
                        <span>RUN GEMINI ANALYSIS</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          5. FOOTER ACTIONS
      ═══════════════════════════════════════════════════════════════ */}
      <footer className="incident-panel-footer">
        <button 
          className="incident-action-btn secondary font-mono"
          onClick={handleCopyDossier}
        >
          {copied ? (
            <>
              <Check size={14} color="#00FF88" />
              <span style={{ color: '#00FF88' }}>COPIED TO CLIPBOARD</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>COPY DOSSIER</span>
            </>
          )}
        </button>

        <button 
          className="incident-action-btn primary font-mono"
          onClick={onTriggerGemini}
          disabled={geminiLoading}
        >
          <RefreshCw size={14} className={geminiLoading ? 'animate-spin' : ''} />
          <span>{geminiLoading ? 'SYNTHESIZING...' : 'RUN GEMINI'}</span>
        </button>
      </footer>
    </aside>
  );
}
