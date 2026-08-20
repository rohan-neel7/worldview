import React from 'react';
import { useWorldView } from '../../WorldViewContext.jsx';
import TheaterSidebar from './TheaterSidebar.jsx';
import IncidentCommand from './command/IncidentCommand.jsx';
import DataHealthPopover from './popovers/DataHealthPopover.jsx';
import ExposurePopover from './popovers/ExposurePopover.jsx';
import RiskBreakdownPopover from './popovers/RiskBreakdownPopover.jsx';
import AssetDetailPopover from './popovers/AssetDetailPopover.jsx';
import EvidenceDetailPopover from './popovers/EvidenceDetailPopover.jsx';

export default function CrisisModeWorkspace({
  earthquakeData = [],
  viewer = null,
  geminiReport = null,
  geminiLoading = false,
  onTriggerGemini = null,
}) {
  const {
    showHUD,
    selectedCrisis,
    clearSelectedCrisis,
    activePopover,
    closePopover,
  } = useWorldView();

  return (
    <div className="crisis-mode-workspace-container" aria-label="Crisis Intelligence Workspace">
      {/* ── Left: Operational Theater & Crisis Queue Sidebar ── */}
      {showHUD && (
        <TheaterSidebar earthquakeData={earthquakeData} />
      )}

      {/* ── Right: Side-Mounted Incident Command Workspace ── */}
      {Boolean(selectedCrisis) && (
        <IncidentCommand
          isOpen={true}
          onClose={clearSelectedCrisis}
          viewer={viewer}
          geminiReport={geminiReport}
          geminiLoading={geminiLoading}
          onTriggerGemini={onTriggerGemini}
        />
      )}

      {/* ── Contextual Level-2 Popovers (Strict Single Popover Invariant) ── */}
      {activePopover?.type === 'DATA_HEALTH' && (
        <DataHealthPopover onClose={closePopover} />
      )}

      {activePopover?.type === 'EXPOSURE' && (
        <ExposurePopover
          incident={activePopover.data?.incident || selectedCrisis}
          impactData={activePopover.data?.impactData}
          onClose={closePopover}
        />
      )}

      {activePopover?.type === 'RISK_BREAKDOWN' && (
        <RiskBreakdownPopover
          incident={activePopover.data?.incident || selectedCrisis}
          onClose={closePopover}
        />
      )}

      {activePopover?.type === 'ASSET' && (
        <AssetDetailPopover
          asset={activePopover.data}
          onClose={closePopover}
        />
      )}

      {activePopover?.type === 'EVIDENCE' && (
        <EvidenceDetailPopover
          evidenceItem={activePopover.data}
          onClose={closePopover}
        />
      )}
    </div>
  );
}
