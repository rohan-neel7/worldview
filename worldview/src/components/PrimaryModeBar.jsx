import React, { useEffect, useRef } from 'react';
import { useWorldView } from '../WorldViewContext';
import { Globe, ShieldAlert, Radio, Layers } from 'lucide-react';

function LiveUtcClock() {
  const clockRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      if (clockRef.current) {
        const now = new Date();
        const day = String(now.getUTCDate()).padStart(2, '0');
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const mon = months[now.getUTCMonth()];
        const year = now.getUTCFullYear();
        const time = now.toISOString().split('T')[1].split('.')[0];
        clockRef.current.innerText = `UTC  ${day} ${mon} ${year}  ${time}`;
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

      {/* ── Right: Theater Context & Live Clock ── */}
      <div className="mode-bar-right">
        <div className="theater-status-pill">
          {isCrisisMode ? (
            <>
              <span style={{ fontSize: '14px', lineHeight: 1 }}>THEATER:</span>
              <span className="theater-flag">{selectedCountry.flag}</span>
              <span className="theater-name font-display" style={{ fontWeight: 600 }}>{selectedCountry.name.toUpperCase()}</span>
              {selectedCrisis && <span className="incident-live-tag" style={{ color: 'var(--severity-critical)', fontWeight: 600 }}>[ACTIVE]</span>}
            </>
          ) : (
            <>
              <Radio size={12} style={{ color: 'var(--color-cyan)' }} />
              <span className="theater-name font-display" style={{ fontWeight: 600 }}>GLOBAL FEED</span>
              <span style={{ color: 'var(--color-text-muted)' }}>[{activePreset}]</span>
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
