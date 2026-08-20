import React from 'react';
import { ShieldAlert, CheckCircle2, Filter, RefreshCw } from 'lucide-react';
import CrisisListItem from './CrisisListItem.jsx';

export default function CrisisQueue({
  crises = [],
  selectedCrisisId = null,
  crisisFilter = 'ALL',
  onSelectFilter,
  onSelectCrisis,
  onRefresh,
  selectedCountryName = 'Current Theater',
}) {
  const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'MONITORING'];

  return (
    <div className="crisis-queue-container">
      {/* Queue Header & Filters */}
      <div className="crisis-queue-header">
        <div className="queue-title-row">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-red" />
          <span className="queue-title font-display">CRISIS QUEUE ({crises.length})</span>
          </div>

          {onRefresh && (
            <button 
              className="queue-refresh-btn" 
              onClick={onRefresh}
              title="Refresh sensor correlation"
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>

        {/* Compact Filter Buttons */}
        <div className="queue-filters-bar" role="group" aria-label="Crisis Queue Filters">
          {FILTERS.map((f) => (
            <button
              key={f}
            className={`queue-filter-btn ${crisisFilter === f ? 'active' : ''}`}
              onClick={() => onSelectFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Queue List / Non-Happy Path State */}
      <div className="crisis-queue-scroll-list">
        {crises.length === 0 ? (
          <div className="queue-empty-state">
            <CheckCircle2 size={24} className="text-green" />
            <div className="empty-title font-display">NO ACTIVE INCIDENTS</div>
            <p className="empty-sub">
              {selectedCountryName} is within normal background monitoring thresholds. 
              No multi-source crisis candidates meet escalation criteria.
            </p>
          </div>
        ) : (
          crises.map((incident, idx) => (
            <CrisisListItem
              key={incident.id || idx}
              incident={incident}
              index={idx}
              isSelected={incident.id === selectedCrisisId}
              onSelect={onSelectCrisis}
            />
          ))
        )}
      </div>
    </div>
  );
}
