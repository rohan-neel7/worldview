import React, { useEffect, useRef } from 'react';
import { useWorldView } from '../WorldViewContext';
import { 
  Activity, 
  Radio, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Database,
  ArrowLeft,
  Server
} from 'lucide-react';

function LiveUtcClock() {
  const clockRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      if (clockRef.current) {
        clockRef.current.innerText = new Date().toISOString().replace('T', ' ').split('.')[0] + 'Z';
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span ref={clockRef} className="utc-clock-val font-mono">--</span>;
}

export default function BottomStatusBar() {
  const {
    isCrisisMode,
    selectedCountry,
    selectedCrisis,
    clearSelectedCrisis,
    pipelineMetrics,
    openPopover,
    activePopover,
  } = useWorldView();

  const handleToggleDataHealth = () => {
    if (activePopover?.type === 'DATA_HEALTH') {
      openPopover(null);
    } else {
      openPopover('DATA_HEALTH');
    }
  };

  return (
    <footer className="bottom-status-bar" aria-label="System and Operational Status Bar">
      {/* Left: Mode & Pipeline */}
      <div className="status-bar-left">
        <div className="status-item mode-indicator">
          {isCrisisMode ? (
            <span className="status-badge badge-crisis">
              <ShieldAlert size={12} />
              <span>CRISIS THEATER</span>
            </span>
          ) : (
            <span className="status-badge badge-world">
              <Radio size={12} />
              <span>WORLD SURVEILLANCE</span>
            </span>
          )}
        </div>

        <div className="status-item pipeline-stat" title="Total Canonical Ingested / Active in Working Memory">
          <Database size={12} className="stat-icon" />
          <span className="stat-label">PIPELINE:</span>
          <span className="stat-val font-mono">
            {pipelineMetrics?.activeEventsInStore || 0} events
          </span>
        </div>

        <div className="status-item incidents-stat" title="Unique Active Deduplicated Incidents">
          <Activity size={12} className="stat-icon" />
          <span className="stat-label">ACTIVE:</span>
          <span className="stat-val font-display" style={{ color: 'var(--color-cyan)', fontWeight: 600 }}>
            {pipelineMetrics?.activeIncidents || 0}
          </span>
        </div>
      </div>

      {/* Center: Theater / Incident Context */}
      <div className="status-bar-center">
        {isCrisisMode && (
          <div className="theater-context-strip">
            <span className="theater-flag-small">{selectedCountry.flag}</span>
            <span className="theater-name-label font-display">{selectedCountry.name.toUpperCase()} THEATER</span>
            {selectedCrisis && (
              <>
                <span className="strip-divider">/</span>
                <span className="active-incident-label text-truncate" title={selectedCrisis.title}>
                  {selectedCrisis.title}
                </span>
                <button 
                  className="return-theater-btn" 
                  onClick={clearSelectedCrisis}
                  title="Return to Theater Overview"
                >
                  <ArrowLeft size={11} />
                  <span>RETURN</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: Data Health & Clock */}
      <div className="status-bar-right">
        <button 
          className={`data-health-btn ${activePopover?.type === 'DATA_HEALTH' ? 'active' : ''}`}
          onClick={handleToggleDataHealth}
          title="Inspect Connected Providers Data Health & Latency"
          aria-expanded={activePopover?.type === 'DATA_HEALTH'}
        >
          <Server size={12} />
          <span>DATA HEALTH</span>
          <span className="health-dot-live" />
        </button>

        <div className="status-item sync-status">
          <CheckCircle2 size={12} style={{ color: 'var(--status-available)' }} />
          <span className="stat-label font-mono">SYNCED</span>
        </div>

        <div className="status-item live-clock">
          <Clock size={12} className="stat-icon" />
          <LiveUtcClock />
        </div>
      </div>
    </footer>
  );
}
