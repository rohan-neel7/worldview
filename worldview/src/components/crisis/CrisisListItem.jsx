import React from 'react';
import { Activity, Waves, Flame, AlertTriangle, ChevronRight } from 'lucide-react';
import DataStateBadge from '../common/DataStateBadge.jsx';

function renderHazardIcon(type, size = 13, className = '') {
  switch (type) {
    case 'EARTHQUAKE':
      return <Activity size={size} className={className} />;
    case 'FLOOD':
    case 'TSUNAMI':
      return <Waves size={size} className={className} />;
    case 'WILDFIRE':
      return <Flame size={size} className={className} />;
    default:
      return <AlertTriangle size={size} className={className} />;
  }
}

export default function CrisisListItem({
  incident,
  index = 0,
  isSelected = false,
  onSelect,
}) {
  if (!incident) return null;

  const severity = incident.severity || 'MODERATE';
  const risk = incident.risk || {};
  const priority = incident.priority || risk.score || null;

  const primaryEvidence = incident.evidence?.find((e) => e.metrics?.magnitude) || incident.evidence?.[0] || {};
  const magnitude = primaryEvidence.metrics?.magnitude || incident.impactData?.magnitude;
  const place = incident.location?.name || incident.impactData?.place || 'Regional Epicenter';
  const sourceMode = incident.sourceMode || 'LIVE';

  // Event confidence from upstream telemetry
  const eventConfidence = incident.confidence || risk.confidence;
  const eventConfidencePct = eventConfidence != null ? Math.round(eventConfidence * 100) : null;

  // Single clean title combining magnitude and place without duplication
  const titleText = magnitude != null 
    ? `M${magnitude.toFixed(1)} — ${place}`
    : (incident.title || place);

  return (
    <div 
      className={`crisis-queue-item ${isSelected ? 'selected' : ''} sev-${severity.toLowerCase()}`}
      onClick={() => onSelect?.(incident)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(incident);
        }
      }}
      aria-selected={isSelected}
    >
      {/* ── Line 1: Index + Type + Severity + Data State ── */}
      <div className="item-header-row">
        <div className="item-index-group">
          <span className="item-index">#{String(index + 1).padStart(2, '0')}</span>
          <span className="item-type-badge">{incident.type || 'HAZARD'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <DataStateBadge state={sourceMode === 'LIVE' ? 'LIVE' : 'RECENT'} size="sm" />
          <span className={`item-sev-badge sev-${severity.toLowerCase()}`}>
            {severity}
          </span>
        </div>
      </div>

      {/* ── Line 2: Single-Line Title (No Place Duplication) ── */}
      <div className="item-title-row flex items-center gap-1.5">
        {renderHazardIcon(incident.type, 13, `hazard-icon-small flex-shrink-0 sev-${severity.toLowerCase()}`)}
        <span className="item-title text-truncate font-display" title={titleText}>
          {titleText}
        </span>
      </div>

      {/* ── Line 3: Priority & Confidence Metrics + Action ── */}
      <div className="item-footer-row">
        <div className="item-metrics-group font-mono">
          {priority != null ? (
            <span className="item-priority font-semibold" style={{ color: 'var(--severity-high)' }}>
              PRIORITY {priority}
            </span>
          ) : (
            <span className="text-muted">PRIORITY PENDING</span>
          )}

          <span className="sep">•</span>

          {eventConfidencePct != null ? (
            <span className="item-conf text-cyan">
              {eventConfidencePct}% CONF
            </span>
          ) : (
            <span className="text-muted">CONF PENDING</span>
          )}
        </div>

        <button 
          className="item-inspect-btn font-display"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(incident);
          }}
          aria-label={`Inspect ${titleText}`}
        >
          <span>INSPECT</span>
          <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
