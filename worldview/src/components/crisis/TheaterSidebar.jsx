import React, { useState, useMemo } from 'react';
import { useWorldView } from '../../WorldViewContext.jsx';
import { Search, MapPin, ShieldAlert, Activity, CheckCircle2, ChevronRight } from 'lucide-react';
import CrisisQueue from './CrisisQueue.jsx';

export default function TheaterSidebar({ earthquakeData = [] }) {
  const {
    COUNTRIES,
    selectedCountryId,
    selectedCountry,
    setSelectedCountryId,
    crisisFilter,
    setCrisisFilter,
    activeCrises,
    selectedCrisisId,
    selectCrisis,
    refreshCrisisDiscovery,
  } = useWorldView();

  const [searchQuery, setSearchQuery] = useState('');

  // Data-driven country filtering
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    const q = searchQuery.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
    );
  }, [COUNTRIES, searchQuery]);

  const handleCountryClick = (cId) => {
    setSelectedCountryId(cId);
    refreshCrisisDiscovery(earthquakeData);
  };

  // Triage counters (based on discovered crises for theater)
  const criticalCount = activeCrises.filter((c) => c.severity === 'CRITICAL').length;
  const highCount = activeCrises.filter((c) => c.severity === 'HIGH').length;
  const moderateCount = activeCrises.filter((c) => c.severity === 'MODERATE' || c.severity === 'LOW').length;

  return (
    <aside className="theater-sidebar-container" aria-label="Operational Theater & Crisis Discovery Sidebar">
      {/* ── 1. Operational Theater Selection Header ── */}
      <div className="theater-select-card">
        <div className="theater-header-row">
          <div className="flex items-center gap-1.5">
            <MapPin size={13} className="text-cyan" />
            <span className="section-label">OPERATIONAL THEATER</span>
          </div>
          <span className="live-dot-cyan" />
        </div>

        {/* Country Search */}
        <div className="theater-search-bar">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            placeholder="Search country or theater..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="theater-search-input"
          />
        </div>

        {/* Quick Country Pills Scroll */}
        <div className="theater-pills-row">
          {filteredCountries.map((c) => {
            const isSelected = c.id === selectedCountryId;
            return (
              <button
                key={c.id}
                className={`theater-pill-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleCountryClick(c.id)}
              >
                <span className="pill-flag">{c.flag}</span>
                <span className="pill-name">{c.name}</span>
                {isSelected && <span className="pill-active-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Theater Context & Triage Summary ── */}
      <div className="theater-context-card">
        <div className="theater-context-top">
          <span className="country-flag-large">{selectedCountry.flag}</span>
          <div className="country-title-block">
            <h3 className="country-title font-display">{selectedCountry.name}</h3>
            <div className="country-region-sub">
              {selectedCountry.region} • {selectedCountry.riskProfile}
            </div>
          </div>
        </div>

        {/* Triage Summary KPI Bar */}
        <div className="theater-triage-bar">
          <div className="triage-kpi-item total">
            <span className="t-count text-cyan">{activeCrises.length}</span>
            <span className="t-lbl">ACTIVE</span>
          </div>
          <div className="triage-kpi-item critical">
            <span className="t-count" style={{ color: 'var(--severity-critical)' }}>{criticalCount}</span>
            <span className="t-lbl">CRITICAL</span>
          </div>
          <div className="triage-kpi-item high">
            <span className="t-count" style={{ color: 'var(--severity-high)' }}>{highCount}</span>
            <span className="t-lbl">HIGH</span>
          </div>
          <div className="triage-kpi-item mon">
            <span className="t-count" style={{ color: 'var(--severity-moderate)' }}>{moderateCount}</span>
            <span className="t-lbl">MONITORING</span>
          </div>
        </div>

        {/* Regional Tectonic Vectors */}
        <div className="theater-vectors-grid">
          {selectedCountry.theaters?.slice(0, 3).map((t, idx) => (
            <div key={idx} className="theater-vector-item">
              <span className="vector-bullet" />
              <span className="vector-name text-truncate font-body">{t.name}</span>
              <span className={`vector-risk-tag ${t.risk.toLowerCase()}`}>{t.risk}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Unique Crisis Queue ── */}
      <CrisisQueue
        crises={activeCrises}
        selectedCrisisId={selectedCrisisId}
        crisisFilter={crisisFilter}
        onSelectFilter={setCrisisFilter}
        onSelectCrisis={selectCrisis}
        onRefresh={() => refreshCrisisDiscovery(earthquakeData)}
        selectedCountryName={selectedCountry.name}
      />
    </aside>
  );
}

