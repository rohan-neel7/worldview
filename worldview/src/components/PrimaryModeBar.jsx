import React, { useEffect, useRef } from 'react';
import { useWorldView } from '../WorldViewContext';
import { Globe, ShieldAlert, Radio, Activity, Compass, Layers } from 'lucide-react';

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

  return <span ref={clockRef} className="utc-clock-val">--</span>;
}

export default function PrimaryModeBar() {
  const { 
    activeMode, 
    setActiveMode, 
    isWorldMode, 
    isCrisisMode, 
    selectedCountry, 
    selectedCrisis,
    activePreset 
  } = useWorldView();

  return (
    <header className="primary-mode-bar">
      {/* ── Left: Branding & Subtitle ── */}
      <div className="mode-bar-left">
        <div className="brand-group">
          <Globe size={18} className="brand-icon" />
          <span className="brand-title">WORLDVIEW</span>
          <span className="brand-divider">/</span>
          <span className="brand-tag">OSINT INTELLIGENCE</span>
        </div>
        <div className="classification-pill">
          UNCLASSIFIED // OPEN SOURCE
        </div>
      </div>

      {/* ── Center: Architectural Primary Mode Selector ── */}
      <div className="mode-bar-center">
        <div className="mode-selector-container" role="tablist" aria-label="Operating Mode Selector">
          <button
            role="tab"
            aria-selected={isWorldMode}
            className={`mode-tab-btn ${isWorldMode ? 'active world-active' : ''}`}
            onClick={() => setActiveMode('WORLD')}
          >
            <Layers size={14} className="mode-icon" />
            <span className="mode-label">WORLD</span>
            {isWorldMode && <span className="mode-active-indicator" />}
          </button>

          <button
            role="tab"
            aria-selected={isCrisisMode}
            className={`mode-tab-btn ${isCrisisMode ? 'active crisis-active' : ''}`}
            onClick={() => setActiveMode('CRISIS')}
          >
            <ShieldAlert size={14} className="mode-icon" />
            <span className="mode-label">CRISIS INTELLIGENCE</span>
            {isCrisisMode && <span className="mode-active-indicator" />}
          </button>
        </div>
      </div>

      {/* ── Right: Telemetry Context & Live Clock ── */}
      <div className="mode-bar-right">
        <div className="theater-status-pill">
          {isCrisisMode ? (
            <>
              <span className="theater-flag">{selectedCountry.flag}</span>
              <span className="theater-name">{selectedCountry.name.toUpperCase()} THEATER</span>
              {selectedCrisis && <span className="incident-live-tag">[EVENT ACTIVE]</span>}
            </>
          ) : (
            <>
              <Radio size={12} className="live-pulse-cyan" />
              <span className="theater-name">GLOBAL FEED</span>
              <span className="preset-name">[{activePreset}]</span>
            </>
          )}
        </div>

        <div className="utc-clock-badge">
          <LiveUtcClock />
        </div>
      </div>
    </header>
  );
}
