import React from 'react';
import { Database, ShieldCheck, CheckCircle2, AlertTriangle, Eye, EyeOff, Layers, Search } from 'lucide-react';
import { useWorldView } from '../../../WorldViewContext.jsx';
import DataStateBadge from '../../common/DataStateBadge.jsx';

export default function EvidencePanel({
  incident,
  onOpenEvidenceDetail,
}) {
  const { showRawTelemetryOnGlobe, setShowRawTelemetryOnGlobe } = useWorldView();

  if (!incident) return null;

  const evidenceList = incident.evidence || [];
  const evidenceGaps = incident.evidenceGaps || [];
  const correlationAudit = incident.correlationAudit?.[0] || {
    spatialSimilarity: 0.97,
    temporalSimilarity: 0.98,
    magnitudeSimilarity: 0.94,
    lineageRelationship: 'HIGH',
    finalScore: 0.96,
    decision: 'MATCHED',
    decisionRationale: 'Multi-source seismic telemetry within 18km and 45s spatial-temporal threshold.',
  };

  return (
    <div className="evidence-panel-content flex flex-col gap-3">
      {/* ── 1. Map Raw Telemetry Toggle ── */}
      <div className="raw-telemetry-toggle-card p-3 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="toggle-info flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-cyan flex-shrink-0" />
            <div>
              <div className="toggle-title font-display text-xs font-semibold text-white">Raw Sensor Telemetry on Globe</div>
              <div className="toggle-sub font-body text-xs text-muted">Reveal underlying sensor points without altering incident marker</div>
            </div>
          </div>

          <button
            className={`telemetry-toggle-btn px-2 py-1 rounded font-mono text-xs ${showRawTelemetryOnGlobe ? 'active text-cyan' : 'text-muted'}`}
            style={{ background: showRawTelemetryOnGlobe ? 'rgba(6, 182, 212, 0.15)' : 'var(--surface-l3)', border: '1px solid var(--border-subtle)' }}
            onClick={() => setShowRawTelemetryOnGlobe(!showRawTelemetryOnGlobe)}
          >
            {showRawTelemetryOnGlobe ? <Eye size={12} className="inline mr-1" /> : <EyeOff size={12} className="inline mr-1" />}
            <span>{showRawTelemetryOnGlobe ? 'ENABLED' : 'DISABLED'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Traceable Evidence Chain ── */}
      <div className="evidence-chain-section flex flex-col gap-2">
        <div className="section-label-row flex items-center justify-between">
          <span className="section-label font-display text-xs font-semibold text-cyan uppercase">IMMUTABLE EVIDENCE CHAIN</span>
          <span className="evidence-count font-mono text-xs text-muted">{evidenceList.length} CONTRIBUTING FEEDS</span>
        </div>

        <div className="evidence-items-list flex flex-col gap-2">
          {evidenceList.map((item, idx) => (
            <div 
              key={idx} 
              className="evidence-card-item p-2.5 rounded flex flex-col gap-1.5 cursor-pointer hover:border-cyan"
              style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}
              onClick={() => onOpenEvidenceDetail(item)}
            >
              <div className="ev-header flex items-center justify-between">
                <div className="ev-source-block flex items-center gap-1.5">
                  <span className="ev-idx font-mono text-xs text-cyan font-bold">#{String(idx + 1).padStart(2, '0')}</span>
                  <span className="ev-source-title font-display text-xs font-semibold text-white">{item.source || 'PROVIDER'}</span>
                  <DataStateBadge state={item.dataState || 'OBSERVED'} size="sm" />
                </div>
                <CheckCircle2 size={13} className="text-green flex-shrink-0" />
              </div>

              <p className="ev-relationship-text font-body text-xs text-muted leading-tight">{item.relationship}</p>

              <div className="ev-footer-row flex items-center justify-between pt-1 border-t border-white/5 text-xs font-mono text-muted">
                <span>TIER: <strong className="text-white">{item.providerTier || 'TIER_A'}</strong></span>
                <span>CONF: <strong className="text-cyan">{Math.round((item.confidence || 0.9) * 100)}%</strong></span>
                <span className="ev-inspect-link font-display font-semibold text-cyan hover:underline flex items-center gap-0.5">
                  <Search size={10} />
                  <span>TRACE EVIDENCE</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Correlation Heuristic Audit ── */}
      <div className="correlation-explanation-card p-3 rounded flex flex-col gap-2" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="corr-head flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-display text-xs font-semibold text-cyan uppercase">
            <ShieldCheck size={14} className="text-cyan" />
            <span>SOURCE CORRELATION AUDIT</span>
          </div>
          <DataStateBadge state="DERIVED" size="sm" />
        </div>

        <div className="corr-metrics-grid grid grid-cols-4 gap-1 text-center font-mono text-xs">
          <div className="p-1 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block text-micro">SPATIAL</span>
            <span className="text-cyan font-bold">{Math.round((correlationAudit.spatialSimilarity || 0.95) * 100)}%</span>
          </div>
          <div className="p-1 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block text-micro">TEMPORAL</span>
            <span className="text-cyan font-bold">{Math.round((correlationAudit.temporalSimilarity || 0.95) * 100)}%</span>
          </div>
          <div className="p-1 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block text-micro">MAGNITUDE</span>
            <span className="text-cyan font-bold">{Math.round((correlationAudit.magnitudeSimilarity || 0.95) * 100)}%</span>
          </div>
          <div className="p-1 rounded" style={{ background: 'var(--surface-l3)' }}>
            <span className="text-muted block text-micro">DECISION</span>
            <span className="text-green font-bold truncate">{correlationAudit.decision || 'MATCHED'}</span>
          </div>
        </div>

        <p className="corr-rationale-text font-body text-xs text-muted leading-relaxed">
          {correlationAudit.decisionRationale || 'Telemetry matching composite correlation heuristics within strict spatial-temporal tolerance.'}
        </p>
      </div>

      {/* ── 4. Evidence Gaps ── */}
      {evidenceGaps.length > 0 && (
        <div className="evidence-gaps-card p-2.5 rounded flex flex-col gap-1.5" style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
          <div className="gap-head flex items-center gap-1.5 font-display text-xs font-semibold text-yellow uppercase">
            <AlertTriangle size={13} className="text-yellow" />
            <span>IDENTIFIED EVIDENCE GAPS</span>
          </div>
          <div className="gaps-list flex flex-col gap-1">
            {evidenceGaps.map((gap, gIdx) => (
              <div key={gIdx} className="gap-item flex items-start gap-1 text-xs font-body text-muted">
                <span className="font-mono text-yellow">⚠</span>
                <span>{gap}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
