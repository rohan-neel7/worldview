import React from 'react';
import { 
  FileText, 
  Users, 
  AlertTriangle, 
  Database, 
  CheckSquare, 
  Clock, 
  Bot 
} from 'lucide-react';

const TABS = [
  { id: 'OVERVIEW', label: 'OVERVIEW', icon: FileText },
  { id: 'IMPACT', label: 'IMPACT', icon: Users },
  { id: 'RISKS', label: 'RISKS', icon: AlertTriangle },
  { id: 'EVIDENCE', label: 'EVIDENCE', icon: Database },
  { id: 'RESPONSE', label: 'RESPONSE', icon: CheckSquare },
  { id: 'TIMELINE', label: 'TIMELINE', icon: Clock },
  { id: 'AI', label: 'AI ANALYSIS', icon: Bot },
];

export default function IncidentTabs({ activeTab, onSelectTab }) {
  return (
    <div className="incident-tabs-bar" role="tablist" aria-label="Incident Command Workspace Tabs">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`incident-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <Icon size={13} className="tab-icon" />
            <span className="tab-label">{tab.label}</span>
            {isActive && <span className="tab-active-indicator" />}
          </button>
        );
      })}
    </div>
  );
}
