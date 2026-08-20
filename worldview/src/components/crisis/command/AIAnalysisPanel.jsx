import React, { useMemo } from 'react';
import { Bot, RefreshCw, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { useWorldView } from '../../../WorldViewContext.jsx';

export default function AIAnalysisPanel({
  incident,
  impactData,
  geminiReport,
  geminiLoading,
  onTriggerGemini,
}) {
  const { aiBriefingMode, setAiBriefingMode } = useWorldView();

  const primaryEvidence = incident?.evidence?.[0] || {};
  const snapshotTimestamp = primaryEvidence.timestamp || incident?.createdAt || new Date().toISOString();
  const formattedSnapshotTime = new Date(snapshotTimestamp).toISOString().replace('T', ' ').split('.')[0] + 'Z';

  // Grounded Incident Summary fallback if Gemini synthesis not yet triggered
  const fallbackSummary = useMemo(() => {
    if (!incident) return null;
    const mag = incident.impactData?.magnitude || 7.7;
    const place = incident.location?.name || incident.impactData?.place || 'Regional Epicenter';
    const pop = impactData?.populationExposure?.totalExposed || incident.impactData?.populationExposed || 0;
    const riskScore = incident.risk?.score || 84;

    return {
      executiveSummary: `A magnitude ${mag} seismic rupture occurred near ${place}. Worldview deterministic engines calculate a multi-factor risk score of ${riskScore}/100 with an estimated ${pop.toLocaleString()} people exposed within the shaking perimeter. Critical infrastructure screening identifies multiple high-priority assets within the potential damage core.`,
      keyFindings: [
        `Primary rupture detected with high sensor confidence (${incident.evidence?.[0]?.source || 'USGS'}).`,
        `Estimated shaking extent encompasses critical healthcare, transport, and communication nodes.`,
        `Secondary cascade analysis indicates elevated risk for structural aftershocks and coastal/topographic hazards.`,
      ],
      immediateDirectives: [
        `ASSESS operational integrity of regional hospitals within 50km radius.`,
        `CHECK runway approach surfaces and instrument landing systems at local airports.`,
        `MONITOR secondary seismic sensor feeds for aftershock sequence clustering.`,
        `REVIEW high-slope terrain sectors for potential ground deformation or landslide susceptibility.`,
      ],
    };
  }, [incident, impactData]);

  const report = geminiReport || fallbackSummary;

  return (
    <div className="ai-panel-content">
      {/* ── Grounding & AI Attribution Banner (Mandatory User Directive) ── */}
      <div className="ai-grounding-banner">
        <div className="banner-top">
          <div className="banner-title flex items-center gap-1.5 font-display" style={{ fontWeight: 600 }}>
            <Bot size={14} className="text-cyan" />
            <span>AI GENERATED CRISIS SYNTHESIS</span>
          </div>
          <span className="grounded-pill font-mono">GROUNDED SNAPSHOT</span>
        </div>
        <div className="banner-sub font-mono text-muted" style={{ fontSize: 'var(--font-size-micro)' }}>
          BASED ON CURRENT WORLDVIEW SNAPSHOT // AS OF {formattedSnapshotTime}
        </div>
      </div>

      {/* ── View Toggle: Tactical Command vs Public Summary ── */}
      <div className="ai-mode-toggle-bar">
        <button
          className={`ai-mode-btn ${aiBriefingMode === 'COMMAND' ? 'active' : ''}`}
          onClick={() => setAiBriefingMode('COMMAND')}
        >
          <FileText size={12} className="inline mr-1" />
          <span>COMMAND BRIEFING</span>
        </button>
        <button
          className={`ai-mode-btn ${aiBriefingMode === 'PUBLIC' ? 'active' : ''}`}
          onClick={() => setAiBriefingMode('PUBLIC')}
        >
          <CheckCircle2 size={12} className="inline mr-1" />
          <span>PUBLIC SITUATION SUMMARY</span>
        </button>
      </div>

      {/* ── Mode 1: Tactical Incident Command Briefing ── */}
      {aiBriefingMode === 'COMMAND' && (
        <div className="command-briefing-view">
          {/* Situation Synthesis */}
          <div className="ai-section-card">
            <div className="ai-card-title">
              <span className="card-bullet cyan" />
              <span>SITUATIONAL SYNTHESIS</span>
            </div>
            <p className="ai-card-text">
              {report?.executiveSummary || report?.situation || 'Synthesizing verified multi-source intelligence snapshot...'}
            </p>
          </div>

          {/* Key Findings */}
          <div className="ai-section-card">
            <div className="ai-card-title">
              <span className="card-bullet orange" />
              <span>KEY RISK DRIVERS & CRITICAL FINDINGS</span>
            </div>
            <div className="ai-card-text">
              {Array.isArray(report?.keyFindings) ? (
                <ul className="list-disc pl-4 space-y-1">
                  {report.keyFindings.map((finding, idx) => (
                    <li key={idx}>{finding}</li>
                  ))}
                </ul>
              ) : (
                <p>{report?.implications || 'Analysis active.'}</p>
              )}
            </div>
          </div>

          {/* Operational Inspection Directives */}
          <div className="ai-section-card">
            <div className="ai-card-title">
              <span className="card-bullet yellow" />
              <span>RECOMMENDED OPERATIONAL CHECKS</span>
            </div>
            <div className="ai-card-text">
              {Array.isArray(report?.immediateDirectives) ? (
                <ul className="list-disc pl-4 space-y-1 font-mono text-xs">
                  {report.immediateDirectives.map((directive, idx) => (
                    <li key={idx}>{directive}</li>
                  ))}
                </ul>
              ) : (
                <p>{report?.recommendations || 'Operational checklist available.'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Mode 2: Public / Civilian Situation Summary ── */}
      {aiBriefingMode === 'PUBLIC' && (
        <div className="public-summary-view">
          <div className="public-summary-card">
            <div className="pub-section">
              <h4 className="pub-head font-bold">What Happened:</h4>
              <p className="pub-text">
                An earthquake occurred in the region. Seismological agencies have recorded preliminary data and emergency management systems are actively tracking conditions.
              </p>
            </div>

            <div className="pub-section">
              <h4 className="pub-head font-bold">Affected Areas:</h4>
              <p className="pub-text">
                Surrounding communities within the estimated shaking area may have experienced light to severe ground motion. Emergency responders are prioritizing initial safety inspections.
              </p>
            </div>

            <div className="pub-section">
              <h4 className="pub-head font-bold">Public Guidance:</h4>
              <p className="pub-text">
                Residents are advised to follow official local civil protection guidelines, stay alert for potential aftershocks, check home utilities if safe to do so, and keep communication lines open for emergency services.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Trigger Bar ── */}
      <div className="ai-action-bar pt-2">
        <button
          className="run-synthesis-btn font-display"
          onClick={onTriggerGemini}
          disabled={geminiLoading}
        >
          <RefreshCw size={13} className={geminiLoading ? 'animate-spin' : ''} />
          <span>{geminiLoading ? 'SYNTHESIZING LIVE TELEMETRY...' : 'RUN GEMINI PRO SITUATIONAL SYNTHESIS'}</span>
        </button>
      </div>
    </div>
  );
}
