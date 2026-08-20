import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Radio, 
  Activity, 
  Plane, 
  Orbit, 
  Ship, 
  RefreshCw, 
  Copy, 
  Check, 
  X, 
  Crosshair,
  AlertTriangle,
  Clock,
  Compass,
  Navigation,
  Flame,
  Zap,
  Target
} from 'lucide-react';
import * as Cesium from 'cesium';

export default function CrisisIntelligenceOverlay({
  isOpen,
  onClose,
  report,
  loading,
  onTrigger,
  telemetry = {},
  earthquakeData = [],
  viewer
}) {
  const [copied, setCopied] = useState(false);
  const [ingestStep, setIngestStep] = useState(0);
  const [activeTargetId, setActiveTargetId] = useState(null);
  const [redirectToast, setRedirectToast] = useState(null);

  // Compute Top 5 highest magnitude earthquakes
  const topQuakes = useMemo(() => {
    if (!earthquakeData || earthquakeData.length === 0) return [];
    return [...earthquakeData]
      .filter(q => q.lat != null && q.lon != null)
      .sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0))
      .slice(0, 5);
  }, [earthquakeData]);

  // Animate ingestion steps while loading
  useEffect(() => {
    if (!loading) {
      setIngestStep(0);
      return;
    }
    const interval = setInterval(() => {
      setIngestStep(prev => (prev + 1) % 4);
    }, 600);
    return () => clearInterval(interval);
  }, [loading]);

  // Keyboard shortcut to close (ESC)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const {
    priority = 'LOW',
    situation = '',
    impact = '',
    directive = '',
    timestamp
  } = report || {};

  const {
    flightCount = 0,
    quakeCount = 0,
    satCount = 0,
    shipCount = 0,
    topQuake = null,
    selectedRegion = 'GLOBAL'
  } = telemetry;

  const formattedTime = timestamp
    ? new Date(timestamp).toISOString().replace('T', ' ').split('.')[0] + 'Z'
    : new Date().toISOString().replace('T', ' ').split('.')[0] + 'Z';

  const handleCopyReport = () => {
    const quakeListText = topQuakes.map((q, idx) => 
      `  #${idx + 1} M${q.magnitude?.toFixed(1)} - ${q.place || 'Unknown'} [LAT: ${q.lat?.toFixed(2)}, LON: ${q.lon?.toFixed(2)}, DEPTH: ${q.depth || 10}km]`
    ).join('\n');

    const text = `=======================================================
WORLDVIEW TACTICAL CRISIS INTELLIGENCE DOSSIER
CLASSIFICATION: UNCLASSIFIED // OPEN SOURCE OSINT
TIMESTAMP: ${formattedTime}
THEATER: ${selectedRegion}
THREAT LEVEL: [PRIORITY: ${priority}]
=======================================================

[01. SITUATION ASSESSMENT & ANOMALY DETECTION]
${situation}

[02. STRATEGIC & INFRASTRUCTURE IMPACT]
${impact}

[03. OPERATIONAL DIRECTIVE & SENSOR TASKING]
${directive}

=======================================================
TOP 5 SEISMIC VECTORS (REAL-TIME):
${quakeListText || '  Nominal baseline across monitored regions'}
=======================================================
INGESTED GLOBAL TELEMETRY:
- Airspace Contacts: ${flightCount}
- Active Satellites: ${satCount}
- 24h Seismic Events: ${quakeCount}
- Maritime Vessels: ${shipCount}
=======================================================`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleRedirectPOV = (quake, idx) => {
    if (!viewer || viewer.isDestroyed()) return;
    if (quake.lat == null || quake.lon == null) return;

    setActiveTargetId(quake.id || idx);

    // Cancel in-progress camera flight
    try { 
      viewer.camera.cancelFlight(); 
      viewer.trackedEntity = undefined;
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    } catch(e) {}

    // Smoothly fly camera to the epicenter
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(quake.lon, quake.lat, 850000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-55),
        roll: 0.0
      },
      duration: 2.5,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });

    setRedirectToast(`POV CAMERA REDIRECTED TO SEISMIC TARGET #${idx + 1} (M${quake.magnitude?.toFixed(1)} ${quake.place?.slice(0, 24)}...)`);
    setTimeout(() => setRedirectToast(null), 4000);
  };

  const getPriorityTheme = () => {
    if (priority === 'HIGH' || priority === 'CRITICAL') {
      return {
        badgeClass: 'badge-high',
        borderClass: 'border-high',
        text: 'CRITICAL THREAT // LEVEL 1',
        icon: AlertTriangle,
        color: '#FF3333'
      };
    }
    if (priority === 'MED') {
      return {
        badgeClass: 'badge-med',
        borderClass: 'border-med',
        text: 'ELEVATED ANOMALY // LEVEL 2',
        icon: ShieldAlert,
        color: '#FFA500'
      };
    }
    return {
      badgeClass: 'badge-low',
      borderClass: 'border-low',
      text: 'ROUTINE SURVEILLANCE // LEVEL 3',
      icon: Radio,
      color: '#00FFFF'
    };
  };

  const theme = getPriorityTheme();
  const PriorityIcon = theme.icon;

  const getMagnitudeTheme = (mag) => {
    if (mag >= 6.0) return { bg: 'rgba(255, 50, 50, 0.25)', border: '#FF3333', text: '#FF4444', icon: Flame };
    if (mag >= 5.0) return { bg: 'rgba(255, 140, 0, 0.25)', border: '#FF8C00', text: '#FFA500', icon: Zap };
    return { bg: 'rgba(255, 215, 0, 0.15)', border: '#FFD700', text: '#FFD700', icon: Activity };
  };

  const INGEST_STEPS = [
    'INGESTING OPENSKY & CELESTRAK FEEDS...',
    'CORRELATING USGS SEISMIC ANOMALIES...',
    'PROCESSING WITH GEMINI CRISIS AGENT...',
    'COMPILING STRATEGIC DOSSIER...'
  ];

  return (
    <div className="crisis-overlay-backdrop" onClick={onClose}>
      <div 
        className={`crisis-overlay-modal expanded-view ${theme.borderClass}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Neon Border Runner */}
        <div className="modal-border-runner" />
        
        {/* Tactical Corner Accents */}
        <div className="corner-bracket top-left" />
        <div className="corner-bracket top-right" />
        <div className="corner-bracket bottom-left" />
        <div className="corner-bracket bottom-right" />

        {/* ── Overlay Header ── */}
        <div className="crisis-modal-header">
          <div className="crisis-header-left">
            <div className="crisis-header-tag">
              <div className="radar-pulse-ring">
                <div className="radar-pulse-center" style={{ background: theme.color }} />
              </div>
              <PriorityIcon size={18} color={theme.color} className="animate-pulse" />
              <span className="crisis-header-glow-text">TACTICAL CRISIS INTELLIGENCE COMMAND</span>
            </div>
            <div className="crisis-header-meta">
              <span className="meta-badge">THEATER: {selectedRegion}</span>
              <span className="meta-sep">//</span>
              <span className="meta-badge">AI AGENT: GEMINI GEOSPATIAL</span>
              <span className="meta-sep">//</span>
              <span className="meta-time">
                <Clock size={12} color="var(--color-cyan)" /> {formattedTime}
              </span>
            </div>
          </div>

          <div className="crisis-header-right">
            <div className={`crisis-threat-pill large-pill ${theme.badgeClass}`}>
              <div className="threat-pill-dot" />
              {theme.text}
            </div>
            <button className="crisis-close-btn" onClick={onClose} title="Close dossier (ESC)">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Toast Notification for POV Redirection ── */}
        {redirectToast && (
          <div className="crisis-toast-banner">
            <Target size={16} color="var(--color-cyan)" className="animate-spin" />
            <span>{redirectToast}</span>
          </div>
        )}

        {/* ── Live Ingested Telemetry Grid ── */}
        <div className="crisis-telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-card-header">
              <Plane size={14} color="var(--color-cyan)" />
              <span>AIRSPACE CONTACTS</span>
            </div>
            <div className="telemetry-card-value">{flightCount}</div>
            <div className="telemetry-card-sub">OPENSKY LIVE FEED</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-header">
              <Activity size={14} color={topQuake ? '#FF5555' : 'var(--color-cyan)'} />
              <span>24H SEISMIC OCCURRENCES</span>
            </div>
            <div className="telemetry-card-value" style={{ color: topQuake ? '#FF5555' : 'var(--color-cyan)' }}>
              {quakeCount}
            </div>
            <div className="telemetry-card-sub" title={topQuake?.place}>
              {topQuake ? `MAX: M${topQuake.magnitude?.toFixed(1)} ${topQuake.place?.slice(0, 18)}...` : 'NOMINAL BASELINE'}
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-header">
              <Orbit size={14} color="#FFB000" />
              <span>ORBITAL ASSETS (LEO)</span>
            </div>
            <div className="telemetry-card-value" style={{ color: '#FFB000' }}>{satCount}</div>
            <div className="telemetry-card-sub">CELESTRAK NORAD GRID</div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-header">
              <Ship size={14} color="#4AF0FF" />
              <span>MARITIME VESSELS</span>
            </div>
            <div className="telemetry-card-value" style={{ color: '#4AF0FF' }}>{shipCount}</div>
            <div className="telemetry-card-sub">AISSTREAM REAL-TIME</div>
          </div>
        </div>

        {/* ── Two-Column Main Content Body ── */}
        <div className="crisis-modal-body-split">
          {loading ? (
            <div className="crisis-loading-container full-span">
              <div className="crisis-scanner-line" />
              <Radio size={44} color="var(--color-cyan)" className="animate-spin" />
              <div className="crisis-loading-title">INGESTING MULTI-SPECTRUM TELEMETRY</div>
              <div className="crisis-loading-step">{INGEST_STEPS[ingestStep]}</div>
              <div className="crisis-progress-bar">
                <div className="crisis-progress-fill" style={{ width: `${(ingestStep + 1) * 25}%` }} />
              </div>
            </div>
          ) : (
            <>
              {/* ── Left Column: Situation & Impact Dossier ── */}
              <div className="crisis-column-dossier">
                <div className="column-section-title-bar">
                  <span className="column-title-glow">◈ STRATEGIC SITUATION DOSSIER</span>
                  <div className="live-status-pill">LIVE ANALYSIS</div>
                </div>

                <div className="crisis-report-scroll">
                  {/* Section 1: Situation */}
                  <div className="report-section">
                    <div className="report-section-header">
                      <span className="report-section-num">01</span>
                      <span className="report-section-title">SITUATION ASSESSMENT & ANOMALY DETECTION</span>
                      <div className="report-section-line" />
                    </div>
                    <p className="report-section-text">{situation}</p>
                  </div>

                  {/* Section 2: Strategic Impact */}
                  <div className="report-section">
                    <div className="report-section-header">
                      <span className="report-section-num">02</span>
                      <span className="report-section-title">STRATEGIC & INFRASTRUCTURE IMPACT</span>
                      <div className="report-section-line" />
                    </div>
                    <p className="report-section-text">{impact}</p>
                  </div>

                  {/* Section 3: Directives */}
                  <div className="report-section">
                    <div className="report-section-header">
                      <span className="report-section-num">03</span>
                      <span className="report-section-title">TACTICAL DIRECTIVE & SENSOR TASKING</span>
                      <div className="report-section-line" />
                    </div>
                    <div className="report-directive-box">
                      <div className="directive-icon-col">
                        <Crosshair size={22} color="var(--color-cyan)" className="animate-pulse" />
                      </div>
                      <p className="report-directive-text">{directive}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right Column: Top 5 Seismic Vectors & Camera Redirection ── */}
              <div className="crisis-column-seismic">
                <div className="column-section-title-bar">
                  <span className="column-title-glow" style={{ color: '#FF7777' }}>
                    ◈ TOP 5 SEISMIC VECTORS
                  </span>
                  <div className="seismic-count-badge">{topQuakes.length} EVENTS</div>
                </div>

                <div className="seismic-cards-list">
                  {topQuakes.length === 0 ? (
                    <div className="seismic-empty-state">
                      <Activity size={24} color="rgba(255,255,255,0.3)" />
                      <span>NO RECENT HIGH-MAGNITUDE SEISMIC EVENTS</span>
                    </div>
                  ) : (
                    topQuakes.map((quake, idx) => {
                      const mag = quake.magnitude || 0;
                      const magTheme = getMagnitudeTheme(mag);
                      const MagIcon = magTheme.icon;
                      const isTargetActive = activeTargetId === (quake.id || idx);

                      return (
                        <div 
                          key={quake.id || idx} 
                          className={`seismic-target-card ${isTargetActive ? 'active-target' : ''}`}
                          style={{ borderColor: isTargetActive ? 'var(--color-cyan)' : undefined }}
                        >
                          <div className="seismic-card-top">
                            <div className="seismic-rank-col">
                              <span className="seismic-rank-badge">#{idx + 1}</span>
                              <div 
                                className="seismic-mag-pill" 
                                style={{ 
                                  background: magTheme.bg, 
                                  borderColor: magTheme.border, 
                                  color: magTheme.text 
                                }}
                              >
                                <MagIcon size={12} />
                                <span>M{mag.toFixed(1)}</span>
                              </div>
                            </div>

                            <div className="seismic-place-info">
                              <div className="seismic-place-name" title={quake.place}>
                                {quake.place || 'Unknown Epicenter'}
                              </div>
                              <div className="seismic-geo-telemetry">
                                <span>LAT: {quake.lat?.toFixed(3)}°</span>
                                <span>•</span>
                                <span>LON: {quake.lon?.toFixed(3)}°</span>
                                <span>•</span>
                                <span>DEPTH: {quake.depth || 10}km</span>
                              </div>
                            </div>
                          </div>

                          <div className="seismic-card-actions">
                            <button 
                              className={`redirect-camera-btn ${isTargetActive ? 'active' : ''}`}
                              onClick={() => handleRedirectPOV(quake, idx)}
                              title="Fly camera to this exact seismic epicenter"
                            >
                              <Compass size={14} className={isTargetActive ? 'animate-spin' : ''} />
                              <span>{isTargetActive ? 'TARGET LOCKED // REDIRECTED' : 'REDIRECT POV CAMERA'}</span>
                              <Navigation size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Overlay Actions Footer ── */}
        <div className="crisis-modal-footer">
          <div className="crisis-footer-left">
            <button 
              className="crisis-btn secondary"
              onClick={handleCopyReport}
              disabled={loading}
            >
              {copied ? (
                <>
                  <Check size={16} color="#00FF88" />
                  <span style={{ color: '#00FF88' }}>DOSSIER COPIED TO CLIPBOARD</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>EXPORT COMPLETE DOSSIER</span>
                </>
              )}
            </button>
          </div>

          <div className="crisis-footer-right">
            <button 
              className="crisis-btn primary glow-btn"
              onClick={onTrigger}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'ANALYZING TELEMETRY...' : 'RE-INGEST & ANALYZE CRISIS'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
