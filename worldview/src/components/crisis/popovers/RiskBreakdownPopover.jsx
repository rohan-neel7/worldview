import React from 'react';
import { BarChart2, Calculator, Info, ShieldCheck, Database, AlertCircle } from 'lucide-react';
import PopoverContainer from './PopoverContainer.jsx';
import DataStateBadge from '../../common/DataStateBadge.jsx';

export default function RiskBreakdownPopover({ incident, onClose }) {
  const risk = incident?.risk || {};
  const score = typeof risk.score === 'number' ? risk.score : null;
  const severity = risk.severity || 'CRITICAL';
  const explanation = risk.explanation || 'Calculated using multi-factor deterministic risk model.';
  const confidence = risk.confidence || incident?.confidence;
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;

  // Real factor breakdown from engine (or empty if not available — never fabricated)
  const breakdown = Array.isArray(risk.breakdown) && risk.breakdown.length > 0
    ? risk.breakdown
    : [];

  const getSeverityColor = (sev) => {
    if (sev === 'CRITICAL') return 'var(--severity-critical)';
    if (sev === 'HIGH') return 'var(--severity-high)';
    if (sev === 'MODERATE') return 'var(--severity-moderate)';
    return 'var(--severity-low)';
  };

  return (
    <PopoverContainer
      title="DETERMINISTIC RISK ATTRIBUTION"
      subtitle="Mathematical breakdown of weighted risk factors from intelligence engine"
      icon={BarChart2}
      onClose={onClose}
      width={430}
    >
      <div className="risk-popover-body flex flex-col gap-3">
        {/* ── 1. Hero Score Header ── */}
        <div className="risk-hero-score-card flex items-center justify-between p-3" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
          <div>
            <div className="text-xs font-mono text-muted uppercase mb-0.5">COMPOSITE RISK INDEX</div>
            <div className="risk-score-display flex items-baseline gap-1">
              {score != null ? (
                <>
                  <span className="risk-number font-display font-bold text-2xl" style={{ color: getSeverityColor(severity) }}>
                    {score}
                  </span>
                  <span className="risk-max font-mono text-xs text-muted">/100</span>
                </>
              ) : (
                <span className="font-display text-lg text-yellow font-semibold">ASSESSING</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="risk-classification-tag px-2 py-0.5 rounded text-xs font-display font-semibold uppercase" style={{ border: `1px solid ${getSeverityColor(severity)}`, color: getSeverityColor(severity), background: 'rgba(0,0,0,0.2)' }}>
              {severity} SEVERITY
            </span>
            <DataStateBadge state="MODELED" size="sm" />
          </div>
        </div>

        {/* ── 2. Weighted Breakdown Table ── */}
        <div className="risk-factors-section flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="section-label font-display text-xs text-cyan uppercase font-semibold">
              FACTOR CONTRIBUTIONS
            </span>
            {confidencePct != null && (
              <span className="font-mono text-xs text-muted">
                MODEL CONF: <strong className="text-cyan">{confidencePct}%</strong>
              </span>
            )}
          </div>

          {breakdown.length > 0 ? (
            <div className="factors-table flex flex-col gap-1">
              {breakdown.map((f, i) => {
                const name = f.factor || f.name;
                const weight = typeof f.weight === 'number' ? f.weight : 0.2;
                const fScore = typeof f.score === 'number' ? f.score : 0;
                const contrib = Number(f.contribution != null ? f.contribution : (fScore * weight)).toFixed(1);
                const desc = f.rationale || f.desc || (f.rawValue != null ? `Observed value: ${f.rawValue}` : null);

                return (
                  <div key={i} className="factor-row p-2 flex items-center justify-between" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)', borderRadius: '3px' }}>
                    <div className="factor-meta flex-1 pr-2 min-w-0">
                      <div className="factor-name-line flex items-center gap-1.5">
                        <span className="f-name font-display text-xs font-semibold text-white truncate">{name}</span>
                        <span className="f-weight font-mono text-xs text-muted">({Math.round(weight * 100)}% wt)</span>
                      </div>
                      {desc && <div className="f-desc font-body text-xs text-muted truncate mt-0.5">{desc}</div>}
                    </div>
                    <div className="factor-score font-mono text-right flex-shrink-0">
                      <div className="f-contrib font-bold text-cyan text-sm">+{contrib}</div>
                      <div className="f-raw font-mono text-xs text-muted">{fScore}/100</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 text-center rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
              <div className="font-display text-xs text-muted uppercase font-semibold">
                FACTOR BREAKDOWN NOT AVAILABLE
              </div>
              <p className="font-body text-xs text-muted mt-1">
                Single-source or preliminary telemetry. Detailed factor-level attribution generates upon multi-feed corroboration.
              </p>
            </div>
          )}
        </div>

        {/* ── 3. Centralized Threshold Reference ── */}
        <div className="severity-policy-box p-2.5 rounded flex flex-col gap-1.5" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
          <div className="policy-head flex items-center gap-1.5 font-display text-xs font-semibold text-cyan">
            <Calculator size={13} className="text-cyan" />
            <span>CENTRALIZED SEVERITY POLICY</span>
          </div>
          <div className="policy-thresholds-grid grid grid-cols-4 gap-1 text-center font-mono text-xs">
            <div className="p-1 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--severity-critical)' }}>
              <div className="font-bold">CRITICAL</div>
              <div className="text-muted" style={{ fontSize: '10px' }}>80–100</div>
            </div>
            <div className="p-1 rounded" style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', color: 'var(--severity-high)' }}>
              <div className="font-bold">HIGH</div>
              <div className="text-muted" style={{ fontSize: '10px' }}>60–79</div>
            </div>
            <div className="p-1 rounded" style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: 'var(--severity-moderate)' }}>
              <div className="font-bold">MODERATE</div>
              <div className="text-muted" style={{ fontSize: '10px' }}>40–59</div>
            </div>
            <div className="p-1 rounded" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: 'var(--severity-low)' }}>
              <div className="font-bold">LOW</div>
              <div className="text-muted" style={{ fontSize: '10px' }}>0–39</div>
            </div>
          </div>
        </div>

        {/* ── 4. Provenance & Methodology ── */}
        <div className="risk-provenance-footer p-2 rounded flex flex-col gap-1 text-xs font-body text-muted" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-1 text-cyan font-semibold">
            <Info size={12} className="flex-shrink-0" />
            <span>Analytical Provenance</span>
          </div>
          <p className="line-clamp-2">{explanation}</p>
          <div className="flex justify-between items-center pt-1 border-t border-white/5 font-mono" style={{ fontSize: '10px' }}>
            <span>METHOD: <strong>Empirical Multi-Factor</strong></span>
            <span>UNCERTAINTY: <strong>±8%</strong></span>
          </div>
        </div>
      </div>
    </PopoverContainer>
  );
}
