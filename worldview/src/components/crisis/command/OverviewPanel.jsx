import React, { useState } from 'react';
import { ShieldAlert, Activity, TrendingUp, ChevronDown, ChevronRight, BarChart2, Layers } from 'lucide-react';
import DataStateBadge from '../../common/DataStateBadge.jsx';

export default function OverviewPanel({ incident, impactData, onOpenRiskBreakdown }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);

  if (!incident) return null;

  const impact = impactData || incident.impactData;
  const risk = incident.risk || {};
  const status = incident.status || 'ACTIVE';
  const priority = incident.priority || risk.score;
  const riskScore = typeof risk.score === 'number' ? risk.score : null;
  const severity = incident.severity || risk.severity || 'CRITICAL';

  const primaryEvidence = incident.evidence?.find((e) => e.metrics?.magnitude) || incident.evidence?.[0] || {};
  const magnitude = primaryEvidence.metrics?.magnitude || impact?.magnitude;
  const depthKm = primaryEvidence.metrics?.depthKm || impact?.depthKm;
  const place = incident.location?.name || impact?.place || 'Regional Epicenter';

  // Confidence from engine
  const eventConfidence = incident.confidence || risk.confidence;
  const eventConfidencePct = eventConfidence != null ? Math.round(eventConfidence * 100) : null;
  const assessmentConfidence = risk.assessmentConfidence || risk.confidence;
  const assessmentConfidencePct = assessmentConfidence != null ? Math.round(assessmentConfidence * 100) : null;

  // Real factors from engine
  const breakdown = Array.isArray(risk.breakdown) ? risk.breakdown : [];

  // Observation metadata
  const observedAt = incident.createdAt || primaryEvidence.timestamp;
  const formattedTime = observedAt ? new Date(observedAt).toISOString().replace('T', ' ').split('.')[0] + 'Z' : null;
  const sourceCount = incident.evidence?.length || 0;
  const sourceMode = incident.sourceMode || 'LIVE';

  return (
    <div className="overview-panel-content flex flex-col gap-3">
      {/* ── 1. Status & Priority Badge Strip ── */}
      <div className="overview-meta-strip">
        <div className="status-pill-group">
          <span className="meta-caption font-mono uppercase">LIFECYCLE STATUS</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`lifecycle-badge status-${status.toLowerCase()}`}>
              <span className="status-dot" />
              {status}
            </span>
            <DataStateBadge state="LIVE" size="sm" />
          </div>
        </div>

        <div className="priority-pill-group text-right">
          <span className="meta-caption font-mono uppercase">TRIAGE PRIORITY</span>
          <div className="flex items-center gap-1.5 justify-end mt-0.5">
            {priority != null ? (
              <span className="priority-val font-display font-bold" style={{ color: 'var(--severity-high)', fontSize: 'var(--font-size-body)' }}>
                PRIORITY {priority}
              </span>
            ) : (
              <DataStateBadge state="PENDING" label="PENDING" size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Primary 4 Quick Facts with Semantic Badges ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="m-label font-mono uppercase">MAGNITUDE</span>
            <DataStateBadge state="OBSERVED" size="sm" />
          </div>
          <div className="m-score-row mt-0.5">
            <span className="font-display font-bold text-white text-xl">
              {magnitude != null ? `M${magnitude.toFixed(1)}` : 'UNAVAILABLE'}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="m-label font-mono uppercase">DEPTH</span>
            <DataStateBadge state="OBSERVED" size="sm" />
          </div>
          <div className="m-score-row mt-0.5">
            <span className="font-display font-bold text-white text-xl">
              {depthKm != null ? `${depthKm} km` : 'UNAVAILABLE'}
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="m-label font-mono uppercase">EVENT CONF</span>
            <DataStateBadge state="DERIVED" size="sm" />
          </div>
          <div className="m-score-row mt-0.5">
            {eventConfidencePct != null ? (
              <span className="font-display font-bold text-cyan text-xl">
                {eventConfidencePct}%
              </span>
            ) : (
              <DataStateBadge state="PENDING" label="PENDING" size="sm" />
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="m-label font-mono uppercase">MODEL CONF</span>
            <DataStateBadge state="MODELED" size="sm" />
          </div>
          <div className="m-score-row mt-0.5">
            {assessmentConfidencePct != null ? (
              <span className="font-display font-bold text-cyan text-xl">
                {assessmentConfidencePct}%
              </span>
            ) : (
              <DataStateBadge state="PENDING" label="PENDING" size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Structured Situation Grid (Not a generic paragraph) ── */}
      <div className="overview-section p-3 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="section-title-line flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-cyan" />
            <span className="section-title font-display font-semibold text-xs text-cyan uppercase">CURRENT SITUATION</span>
          </div>
          <DataStateBadge state="OBSERVED" size="sm" />
        </div>

        <div className="font-body text-xs text-white mb-2.5 font-medium">
          {magnitude != null ? `M${magnitude.toFixed(1)} seismic event detected near ${place}.` : `Hazard incident detected near ${place}.`}
        </div>

        {/* Structured 4-item parameter grid */}
        <div className="grid grid-cols-2 gap-2 text-xs font-body mb-2">
          <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>FOCAL DEPTH</div>
            <div className="font-semibold text-white mt-0.5">{depthKm != null ? `${depthKm} km` : 'UNAVAILABLE'}</div>
          </div>
          <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>EVENT STATE</div>
            <div className="font-semibold text-green mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />
              {status}
            </div>
          </div>
          <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>PRIMARY CONCERN</div>
            <div className="font-semibold text-orange mt-0.5">Ground shaking exposure</div>
          </div>
          <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>SECONDARY CONCERN</div>
            <div className="font-semibold text-yellow mt-0.5">Aftershock cascade</div>
          </div>
        </div>

        {/* Progressive Disclosure: Expand Full Narrative */}
        <button
          className="w-full flex items-center justify-between pt-1.5 border-t border-white/5 text-xs text-cyan font-display font-medium hover:text-white"
          onClick={() => setShowAssessment(!showAssessment)}
        >
          <span>{showAssessment ? 'COLLAPSE ASSESSMENT' : 'EXPAND ASSESSMENT'}</span>
          {showAssessment ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {showAssessment && (
          <p className="font-body text-xs text-muted leading-relaxed mt-2 pt-2 border-t border-white/5">
            {incident.description || 
              `Automated telemetry corroborated across primary seismic networks. Estimated ground motion attenuation perimeter indicates potential moderate-to-severe shaking in proximal settlements. High-slope sectors monitored for terrain displacement.`
            }
          </p>
        )}
      </div>

      {/* ── 4. Analytical Risk Object ── */}
      <div className="risk-instrument-card p-3 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-red" />
            <span className="font-display font-semibold text-xs text-white uppercase">RISK ASSESSMENT</span>
          </div>
          <DataStateBadge state="MODELED" size="sm" />
        </div>

        <div className="flex items-baseline justify-between mb-2.5">
          <div className="flex items-baseline gap-1">
            <span className="font-display font-bold text-2xl text-red">
              {riskScore != null ? riskScore : 'ASSESSING'}
            </span>
            {riskScore != null && <span className="font-mono text-xs text-muted">/100</span>}
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-display font-semibold text-red uppercase" style={{ background: 'var(--severity-critical-bg)', border: '1px solid var(--severity-critical-border)' }}>
            {severity}
          </span>
        </div>

        {/* Dynamic Engine Factor Breakdown (or explicit Not Available) */}
        {breakdown.length > 0 ? (
          <div className="flex flex-col gap-1 mb-2.5">
            <div className="text-xs font-mono text-muted uppercase font-semibold mb-0.5">PRIMARY FACTORS</div>
            {breakdown.slice(0, 4).map((f, i) => (
              <div key={i} className="flex justify-between items-center text-xs font-body py-0.5">
                <span className="text-muted truncate pr-2">{f.factor || f.name}</span>
                <span className="font-mono font-semibold text-cyan">
                  +{Number(f.contribution != null ? f.contribution : (f.score * (f.weight || 0.2))).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2 rounded text-xs font-body text-muted mb-2 text-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
            FACTOR ATTRIBUTION: PENDING CORROBORATION
          </div>
        )}

        <button
          className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded text-xs font-display font-semibold text-cyan hover:text-white"
          style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)' }}
          onClick={onOpenRiskBreakdown}
        >
          <BarChart2 size={12} />
          <span>WHY THIS SCORE?</span>
        </button>
      </div>

      {/* ── 5. Expandable Provenance & Details ── */}
      <button 
        className="driver-card p-2 rounded flex items-center justify-between" 
        onClick={() => setShowDetails(!showDetails)}
        style={{ cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-l2)' }}
      >
        <span className="driver-title font-display text-xs text-muted uppercase font-semibold">EVENT METADATA & TELEMETRY</span>
        {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {showDetails && (
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-muted uppercase" style={{ fontSize: '10px' }}>COORDINATES</div>
            <div className="text-white mt-0.5">
              {incident.location?.lat != null ? `${incident.location.lat.toFixed(2)}°, ${incident.location.lon.toFixed(2)}°` : 'UNAVAILABLE'}
            </div>
          </div>
          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-muted uppercase" style={{ fontSize: '10px' }}>TIME (UTC)</div>
            <div className="text-white mt-0.5 truncate">{formattedTime || 'UNAVAILABLE'}</div>
          </div>
          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-muted uppercase" style={{ fontSize: '10px' }}>DATA STATE</div>
            <div className="text-cyan mt-0.5">{sourceMode}</div>
          </div>
          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-muted uppercase" style={{ fontSize: '10px' }}>CORROBORATION</div>
            <div className="text-white mt-0.5">{sourceCount > 0 ? `${sourceCount} Feeds` : 'UNAVAILABLE'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
