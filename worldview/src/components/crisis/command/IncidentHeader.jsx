import React, { useState } from 'react';
import { 
  Activity, 
  MapPin, 
  Clock, 
  ArrowLeft, 
  Copy, 
  Check, 
  Waves, 
  Flame, 
  AlertTriangle 
} from 'lucide-react';
import { scoreToSeverity } from '../../../engine/risk/severityPolicy.js';
import DataStateBadge from '../../common/DataStateBadge.jsx';

function renderHazardIcon(type, size = 14, className = '') {
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

export default function IncidentHeader({
  incident,
  impactData,
  onReturn,
  onOpenRiskBreakdown,
}) {
  const [copied, setCopied] = useState(false);

  if (!incident) return null;

  const impact = impactData || incident.impactData;
  const risk = incident.risk || {};
  const riskScore = typeof risk.score === 'number' ? risk.score : null;
  const severity = risk.severity || incident.severity || (riskScore != null ? scoreToSeverity(riskScore) : null);
  const priority = incident.priority || riskScore;

  // Confidence from engine data — never hardcode
  const eventConfidence = incident.confidence || risk.confidence;
  const eventConfidencePct = eventConfidence != null ? Math.round(eventConfidence * 100) : null;
  const assessmentConfidence = risk.assessmentConfidence || risk.confidence;
  const assessmentConfidencePct = assessmentConfidence != null ? Math.round(assessmentConfidence * 100) : null;

  // Metadata Extraction
  const primaryEvidence = incident.evidence?.find((e) => e.metrics?.magnitude) || incident.evidence?.[0] || {};
  const magnitude = primaryEvidence.metrics?.magnitude || impact?.magnitude;
  const depthKm = primaryEvidence.metrics?.depthKm || impact?.depthKm;
  const locationName = incident.location?.name || impact?.place || 'Regional Epicenter';
  const observedAt = incident.createdAt || primaryEvidence.timestamp || new Date().toISOString();
  const formattedObservedTime = new Date(observedAt).toISOString().replace('T', ' ').split('.')[0] + 'Z';
  const sourceMode = incident.sourceMode || 'LIVE';

  const handleCopySummary = () => {
    const text = `WORLDVIEW INCIDENT: ${incident.title || 'Seismic Event'}\n` +
      `LOCATION: ${locationName} (LAT: ${incident.location?.lat}, LON: ${incident.location?.lon})\n` +
      `SEVERITY: ${severity || 'ASSESSING'} | RISK: ${riskScore != null ? riskScore + '/100' : 'ASSESSING'} | PRIORITY: ${priority != null ? priority : 'PENDING'}\n` +
      `CONFIDENCE: Event ${eventConfidencePct != null ? eventConfidencePct + '%' : 'PENDING'} | Assessment ${assessmentConfidencePct != null ? assessmentConfidencePct + '%' : 'PENDING'}\n` +
      `OBSERVED: ${formattedObservedTime} | SOURCE: ${primaryEvidence.source || 'USGS'} (${sourceMode})`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <header className="incident-command-header">
      {/* Top Action Bar */}
      <div className="header-action-row">
        <button 
          className="header-back-btn"
          onClick={onReturn}
          title="Return to Country Theater Overview"
        >
          <ArrowLeft size={13} />
          <span>RETURN TO THEATER</span>
        </button>

        <div className="header-right-actions">
          <button 
            className="header-copy-btn"
            onClick={handleCopySummary}
            title="Copy Incident Summary to Clipboard"
          >
            {copied ? <Check size={13} style={{ color: 'var(--status-available)' }} /> : <Copy size={13} />}
            <span>{copied ? 'COPIED' : 'COPY'}</span>
          </button>
        </div>
      </div>

      {/* Main Title & Type */}
      <div className="header-main-title-block">
        <div className="hazard-type-strip">
          {renderHazardIcon(incident.type, 14, 'hazard-icon')}
          <span className="hazard-type-text font-display" style={{ fontWeight: 600 }}>{incident.type || 'EARTHQUAKE'} INCIDENT</span>
          <DataStateBadge state={sourceMode === 'LIVE' ? 'LIVE' : 'RECENT'} label={`${primaryEvidence.source || 'USGS'} ${sourceMode}`} size="sm" />
        </div>

        <h2 className="incident-headline font-display">
          {incident.title || (magnitude != null ? `M${magnitude.toFixed(1)} ${locationName}` : locationName)}
        </h2>

        <div className="incident-coords-bar">
          <MapPin size={12} style={{ color: 'var(--color-cyan)' }} />
          <span>{locationName}</span>
          {depthKm != null && (
            <>
              <span className="sep">•</span>
              <span>{depthKm} km depth</span>
            </>
          )}
          <span className="sep">•</span>
          <Clock size={12} />
          <span className="font-mono">{formattedObservedTime}</span>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="header-metrics-grid">
        {/* Severity / Risk Card */}
        <div className={`metric-card severity-card ${severity ? `sev-${severity.toLowerCase()}` : ''}`}>
          <div className="flex items-center justify-between">
            <span className="m-label font-mono" style={{ textTransform: 'uppercase' }}>SEVERITY / RISK</span>
            {riskScore != null ? (
              <DataStateBadge state="MODELED" size="sm" />
            ) : (
              <DataStateBadge state="PENDING" label="ASSESSING" size="sm" />
            )}
          </div>
          
          <div className="m-score-row">
            {riskScore != null ? (
              <>
                <span className="m-score-val font-display">{riskScore}</span>
                <span className="m-score-max font-mono">/100</span>
                <span className={`m-sev-tag sev-${severity.toLowerCase()}`}>{severity}</span>
              </>
            ) : (
              <div className="flex items-baseline gap-2 py-1">
                <span className="font-display font-semibold" style={{ fontSize: '18px', color: 'var(--severity-moderate)' }}>
                  ASSESSING
                </span>
                <span className="font-body text-muted" style={{ fontSize: '11px' }}>
                  Risk calculation pending
                </span>
              </div>
            )}
          </div>

          <button className="m-why-link" onClick={onOpenRiskBreakdown}>
            WHY? Analytical factor breakdown
          </button>
        </div>

        {/* Confidence Dual Card */}
        <div className="metric-card confidence-card">
          <div className="flex items-center justify-between">
            <span className="m-label font-mono" style={{ textTransform: 'uppercase' }}>CONFIDENCE RATINGS</span>
            <DataStateBadge state="DERIVED" size="sm" />
          </div>

          <div className="conf-rows">
            <div className="conf-line">
              <span className="c-name font-body" style={{ fontSize: 'var(--font-size-meta)', color: 'var(--color-text-muted)' }}>Event telemetry:</span>
              {eventConfidencePct != null ? (
                <span className="c-val font-display" style={{ color: 'var(--color-cyan)', fontWeight: 600 }}>
                  {eventConfidencePct}%
                </span>
              ) : (
                <DataStateBadge state="PENDING" label="PENDING" size="sm" title="Waiting for corroborating observations" />
              )}
            </div>

            <div className="conf-line">
              <span className="c-name font-body" style={{ fontSize: 'var(--font-size-meta)', color: 'var(--color-text-muted)' }}>Impact model:</span>
              {assessmentConfidencePct != null ? (
                <span className="c-val font-display" style={{ color: 'var(--color-cyan)', fontWeight: 600 }}>
                  {assessmentConfidencePct}%
                </span>
              ) : (
                <DataStateBadge state="PENDING" label="PENDING" size="sm" title="Waiting for demographic model run" />
              )}
            </div>
          </div>

          <div className="conf-sub font-mono" style={{ fontSize: 'var(--font-size-micro)', color: 'var(--color-text-muted)' }}>
            {incident.evidenceGaps?.length || 0} gap flags
          </div>
        </div>
      </div>
    </header>
  );
}
