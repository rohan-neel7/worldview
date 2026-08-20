import React, { useState, useMemo } from 'react';
import { useWorldView } from '../WorldViewContext';
import { 
  ShieldAlert, 
  Search, 
  MapPin, 
  Activity, 
  AlertTriangle, 
  Flame, 
  Waves, 
  Compass, 
  ChevronRight,
  Filter,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function CrisisDiscoverySidebar({ earthquakeData = [] }) {
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
    clearSelectedCrisis,
    refreshCrisisDiscovery,
  } = useWorldView();

  const [searchQuery, setSearchQuery] = useState('');

  // Filter countries by search query
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

  const getHazardIcon = (type) => {
    switch (type) {
      case 'EARTHQUAKE':
        return <Activity size={14} className="hazard-icon seismic" />;
      case 'FLOOD':
      case 'TSUNAMI':
        return <Waves size={14} className="hazard-icon flood" />;
      case 'WILDFIRE':
        return <Flame size={14} className="hazard-icon wildfire" />;
      default:
        return <AlertTriangle size={14} className="hazard-icon alert" />;
    }
  };

  const getSeverityBadgeClass = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return 'sev-badge-critical';
      case 'HIGH':
        return 'sev-badge-high';
      case 'MODERATE':
        return 'sev-badge-moderate';
      default:
        return 'sev-badge-low';
    }
  };

  return (
    <aside className="crisis-discovery-sidebar">
      {/* ── Section 1: Country Theater Selector ── */}
      <div className="discovery-header-card">
        <div className="discovery-section-label">
          <span>OPERATIONAL THEATER</span>
          <span className="discovery-live-dot" />
        </div>

        {/* Search Box */}
        <div className="country-search-box">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            placeholder="Search country or theater..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="country-search-input"
          />
        </div>

        {/* Country Quick Selector Pills */}
        <div className="country-pills-scroll">
          {filteredCountries.map((c) => {
            const isSelected = c.id === selectedCountryId;
            return (
              <button
                key={c.id}
                className={`country-pill-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleCountryClick(c.id)}
              >
                <span className="c-flag">{c.flag}</span>
                <span className="c-name">{c.name}</span>
                {isSelected && <span className="c-active-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Selected Theater Context Card ── */}
      <div className="theater-overview-card">
        <div className="theater-overview-head">
          <div className="theater-title-group">
            <span className="theater-flag-large">{selectedCountry.flag}</span>
            <div>
              <div className="theater-country-title">{selectedCountry.name.toUpperCase()}</div>
              <div className="theater-region-sub">{selectedCountry.region} • {selectedCountry.riskProfile}</div>
            </div>
          </div>
        </div>

        {/* Major Faults / Risk Vectors in Theater */}
        <div className="theater-vectors-grid">
          {selectedCountry.theaters.map((t, idx) => (
            <div key={idx} className="theater-vector-item">
              <span className="vector-bullet" />
              <span className="vector-name">{t.name}</span>
              <span className={`vector-risk-tag ${t.risk.toLowerCase()}`}>{t.risk}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Active Crises Stream (Severity Sorted) ── */}
      <div className="crises-stream-section">
        <div className="crises-stream-header">
          <div className="crises-count-badge">
            <ShieldAlert size={14} color="var(--color-red)" />
            <span>ACTIVE CRISES ({activeCrises.length})</span>
          </div>

          <button
            className="refresh-crises-btn"
            title="Re-run sensor correlation"
            onClick={() => refreshCrisisDiscovery(earthquakeData)}
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Severity & Type Filter Pills */}
        <div className="crisis-filters-bar">
          {['ALL', 'CRITICAL', 'HIGH', 'SEISMIC', 'FLOOD'].map((f) => (
            <button
              key={f}
              className={`filter-pill-btn ${crisisFilter === f ? 'active' : ''}`}
              onClick={() => setCrisisFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List of Discovered Crises */}
        <div className="crises-cards-list">
          {activeCrises.length === 0 ? (
            <div className="no-crises-card">
              <CheckCircle2 size={24} color="#00FF88" />
              <div className="no-crises-title">NO SIGNIFICANT ACTIVE CRISES DETECTED</div>
              <div className="no-crises-sub">
                Sensor feeds streaming nominal telemetry across {selectedCountry.name}.
              </div>
            </div>
          ) : (
            activeCrises.map((crisis, index) => {
              const isSelected = crisis.id === selectedCrisisId;
              return (
                <div
                  key={crisis.id}
                  className={`crisis-event-card ${isSelected ? 'selected' : ''} ${crisis.severity.toLowerCase()}`}
                  onClick={() => selectCrisis(crisis)}
                >
                  <div className="crisis-card-top">
                    <div className="crisis-card-num">
                      #{String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="crisis-card-type">
                      {getHazardIcon(crisis.type)}
                      <span>{crisis.type}</span>
                    </div>
                    <div className={`crisis-severity-pill ${getSeverityBadgeClass(crisis.severity)}`}>
                      {crisis.severity}
                    </div>
                  </div>

                  <div className="crisis-card-body">
                    <div className="crisis-card-title">{crisis.title}</div>
                    <div className="crisis-card-location">
                      <MapPin size={11} className="pin-icon" />
                      <span>{crisis.location?.name || 'Regional Theater'}</span>
                    </div>

                    <div className="crisis-metrics-strip">
                      {crisis.magnitude && (
                        <div className="metric-chip">
                          <span className="chip-lbl">MAG</span>
                          <span className="chip-val">M{crisis.magnitude.toFixed(1)}</span>
                        </div>
                      )}
                      {crisis.metrics?.depthKm != null && (
                        <div className="metric-chip">
                          <span className="chip-lbl">DEPTH</span>
                          <span className="chip-val">{crisis.metrics.depthKm} km</span>
                        </div>
                      )}
                      {crisis.riskScore && (
                        <div className="metric-chip">
                          <span className="chip-lbl">RISK</span>
                          <span className="chip-val highlight-amber">{crisis.riskScore}/100</span>
                        </div>
                      )}
                      <div className="metric-chip">
                        <span className="chip-lbl">CONF</span>
                        <span className="chip-val highlight-cyan">{Math.round((crisis.eventConfidence || 0.95) * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="crisis-card-footer">
                    <span className="crisis-source-tag">{crisis.source}</span>
                    <button className="inspect-crisis-btn">
                      <span>INSPECT</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
