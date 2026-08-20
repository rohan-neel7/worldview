import React from 'react';
import { useWorldView } from '../../../WorldViewContext.jsx';
import IncidentHeader from './IncidentHeader.jsx';
import IncidentTabs from './IncidentTabs.jsx';
import OverviewPanel from './OverviewPanel.jsx';
import ImpactPanel from './ImpactPanel.jsx';
import RisksPanel from './RisksPanel.jsx';
import EvidencePanel from './EvidencePanel.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import TimelinePanel from './TimelinePanel.jsx';
import AIAnalysisPanel from './AIAnalysisPanel.jsx';

export default function IncidentCommand({
  isOpen,
  onClose,
  viewer: _viewer,
  geminiReport,
  geminiLoading,
  onTriggerGemini,
}) {
  const {
    activeIncident,
    activeImpactData,
    clearSelectedCrisis,
    activeIncidentTab,
    setActiveIncidentTab,
    openPopover,
  } = useWorldView();

  if (!isOpen || !activeIncident) return null;

  const incident = activeIncident;
  const impactData = activeImpactData || incident.impactData;

  const handleReturn = () => {
    clearSelectedCrisis();
    onClose?.();
  };

  const handleOpenRiskBreakdown = () => {
    openPopover('RISK_BREAKDOWN', { incident });
  };

  const handleOpenExposure = () => {
    openPopover('EXPOSURE', { incident, impactData });
  };

  const handleOpenAsset = (asset, type) => {
    openPopover('ASSET', { ...asset, assetType: type });
  };

  const handleOpenEvidence = (evidenceItem) => {
    openPopover('EVIDENCE', evidenceItem);
  };

  return (
    <aside className="incident-command-sidebar" aria-label="Incident Command Workspace">
      {/* ── 1. Structured Incident Header ── */}
      <IncidentHeader
        incident={incident}
        impactData={impactData}
        onReturn={handleReturn}
        onOpenRiskBreakdown={handleOpenRiskBreakdown}
      />

      {/* ── 2. Compact Tab Bar ── */}
      <IncidentTabs
        activeTab={activeIncidentTab}
        onSelectTab={setActiveIncidentTab}
      />

      {/* ── 3. Tab Body Viewport ── */}
      <div className="incident-command-tab-viewport">
        {activeIncidentTab === 'OVERVIEW' && (
          <OverviewPanel
            incident={incident}
            impactData={impactData}
            onOpenRiskBreakdown={handleOpenRiskBreakdown}
          />
        )}

        {activeIncidentTab === 'IMPACT' && (
          <ImpactPanel
            incident={incident}
            impactData={impactData}
            onOpenExposurePopover={handleOpenExposure}
            onOpenAssetPopover={handleOpenAsset}
          />
        )}

        {activeIncidentTab === 'RISKS' && (
          <RisksPanel
            incident={incident}
            impactData={impactData}
          />
        )}

        {activeIncidentTab === 'EVIDENCE' && (
          <EvidencePanel
            incident={incident}
            onOpenEvidenceDetail={handleOpenEvidence}
          />
        )}

        {activeIncidentTab === 'RESPONSE' && (
          <ResponsePanel
            incident={incident}
            impactData={impactData}
          />
        )}

        {activeIncidentTab === 'TIMELINE' && (
          <TimelinePanel
            incident={incident}
          />
        )}

        {activeIncidentTab === 'AI' && (
          <AIAnalysisPanel
            incident={incident}
            impactData={impactData}
            geminiReport={geminiReport}
            geminiLoading={geminiLoading}
            onTriggerGemini={onTriggerGemini}
          />
        )}
      </div>
    </aside>
  );
}
