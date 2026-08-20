import React from 'react';
import { useWorldView } from '../WorldViewContext';
import { ShieldAlert, Radio, AlertTriangle, ChevronRight, Activity } from 'lucide-react';

export default function CrisisIntelligencePanel({ onOpenOverlay, onTrigger, loading, report }) {
  const { operationalMode, activeIncident, activeImpactData } = useWorldView();
  const { priority = 'LOW', situation = '' } = report || {};

  const isIncident = operationalMode === 'INCIDENT' && Boolean(activeIncident);

  const getPriorityTheme = () => {
    if (isIncident || priority === 'HIGH' || priority === 'CRITICAL') {
      return {
        badgeClass: 'badge-high',
        text: isIncident ? `INCIDENT: ${activeIncident.risk?.severity || 'HIGH'}` : 'CRITICAL THREAT',
        icon: isIncident ? ShieldAlert : AlertTriangle,
        color: '#FF3333'
      };
    }
    if (priority === 'MED') {
      return {
        badgeClass: 'badge-med',
        text: 'ELEVATED RISK',
        icon: Activity,
        color: '#FFA500'
      };
    }
    return {
      badgeClass: 'badge-low',
      text: 'MONITORING // LIVE',
      icon: Radio,
      color: '#00FFFF'
    };
  };

  const theme = getPriorityTheme();
  const Icon = theme.icon;

  let previewText = situation
    ? (situation.length > 70 ? `${situation.slice(0, 70)}...` : situation)
    : 'Live telemetry ingestion active. Click to view intelligence dossier.';

  if (isIncident) {
    const popExposed = activeImpactData?.exposureMetrics?.populationExposed || 0;
    previewText = `${activeIncident.title} • ${(popExposed > 0 ? `~${Math.round(popExposed / 1000)}k pop exposed` : 'Seismic anomaly')} • ${activeImpactData?.exposureMetrics?.hospitalsCount || 0} hosp in zone`;
  }

  return (
    <div className="crisis-intel-bar" onClick={onOpenOverlay} title="Click to open Tactical Incident Command Dossier">
      <div className={`crisis-bar-pulse-line ${isIncident ? 'pulse-line-red' : ''}`} />
      
      <div className="crisis-bar-left">
        <div className={`crisis-bar-badge ${theme.badgeClass}`}>
          <Icon size={13} className="animate-pulse" color={theme.color} />
          <span>{theme.text}</span>
        </div>
        <div className="crisis-bar-content">
          <span className="crisis-bar-title">{isIncident ? 'INCIDENT COMMAND ACTIVE' : 'CRISIS INTELLIGENCE'}</span>
          <span className="crisis-bar-snippet">{previewText}</span>
        </div>
      </div>

      <div className="crisis-bar-right">
        <button
          className="crisis-bar-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenOverlay();
          }}
        >
          <span>{isIncident ? 'COMMAND' : 'DOSSIER'}</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
