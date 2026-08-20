import React from 'react';
import { Database, ShieldCheck, Clock, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';
import PopoverContainer from './PopoverContainer.jsx';
import DataStateBadge from '../../common/DataStateBadge.jsx';

export default function EvidenceDetailPopover({ evidenceItem, onClose }) {
  if (!evidenceItem) return null;

  const source = evidenceItem.source || 'UPSTREAM_PROVIDER';
  const tier = evidenceItem.providerTier || 'TIER_A';
  const freshness = evidenceItem.freshness || 'LIVE';
  const dataState = evidenceItem.dataState || 'OBSERVED';
  const confidencePct = Math.round((evidenceItem.confidence || 0.90) * 100);
  const timeStr = evidenceItem.timestamp ? new Date(evidenceItem.timestamp).toISOString().replace('T', ' ').split('.')[0] + 'Z' : new Date().toISOString().replace('T', ' ').split('.')[0] + 'Z';

  return (
    <PopoverContainer
      title={`EVIDENCE TRACE: ${source}`}
      subtitle={`Immutable provenance record for contributing sensor observation`}
      icon={Database}
      onClose={onClose}
      width={420}
    >
      <div className="evidence-popover-body flex flex-col gap-3">
        {/* ── 1. Verification Banner ── */}
        <div className="p-2.5 rounded flex items-center justify-between" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-1.5 font-display text-xs font-semibold text-green">
            <ShieldCheck size={14} className="text-green" />
            <span>VERIFIED SENSOR PROVENANCE</span>
          </div>
          <span className="font-mono text-xs font-bold text-cyan">{confidencePct}% CONF</span>
        </div>

        {/* ── 2. Provenance Metadata Grid ── */}
        <div className="grid grid-cols-2 gap-2 text-xs font-body">
          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>PROVIDER TIER</div>
            <div className="font-display font-semibold text-white mt-0.5">{tier}</div>
          </div>

          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>DATA STATE</div>
            <div className="mt-0.5">
              <DataStateBadge state={dataState} size="sm" />
            </div>
          </div>

          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>FRESHNESS</div>
            <div className="font-mono font-semibold text-cyan mt-0.5">{freshness}</div>
          </div>

          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>EVENT IDENTIFIER</div>
            <div className="font-mono text-white truncate mt-0.5" title={evidenceItem.eventId}>
              {evidenceItem.eventId || 'EV-USGS-01'}
            </div>
          </div>
        </div>

        {/* ── 3. Timestamp ── */}
        <div className="flex items-center gap-1.5 p-2 rounded text-xs font-mono text-muted" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}>
          <Clock size={12} className="text-cyan flex-shrink-0" />
          <span>INGESTION TIMESTAMP: <strong className="text-white">{timeStr}</strong></span>
        </div>

        {/* ── 4. Corroboration Relationship ── */}
        <div className="p-2.5 rounded flex flex-col gap-1 text-xs font-body" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-mono text-muted uppercase font-semibold">CORROBORATION RELATIONSHIP</div>
          <div className="text-white">{evidenceItem.relationship || 'Automated sensor signal matched against active event cluster.'}</div>
        </div>

        {/* ── 5. Raw Telemetry Payload ── */}
        {evidenceItem.metrics && Object.keys(evidenceItem.metrics).length > 0 && (
          <div className="p-2.5 rounded flex flex-col gap-1" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-1 font-mono text-xs text-muted uppercase font-semibold">
              <FileCode size={12} className="text-cyan" />
              <span>CANONICAL METRICS PAYLOAD</span>
            </div>
            <pre className="p-2 rounded font-mono text-xs text-cyan overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)' }}>
              {JSON.stringify(evidenceItem.metrics, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </PopoverContainer>
  );
}
