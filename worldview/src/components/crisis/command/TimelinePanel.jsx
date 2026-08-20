import React from 'react';
import { Clock, CheckCircle2, Activity, Database, ShieldCheck, AlertTriangle, Layers } from 'lucide-react';

export default function TimelinePanel({ incident }) {
  const timeBase = incident?.createdAt ? new Date(incident.createdAt) : new Date();

  const formatTimeOffset = (seconds) => {
    const d = new Date(timeBase.getTime() + seconds * 1000);
    return d.toISOString().replace('T', ' ').split('.')[0] + 'Z';
  };

  const TIMELINE_EVENTS = [
    {
      category: 'OBSERVATION',
      label: 'USGS Seismic Telemetry Ingested',
      timestamp: formatTimeOffset(0),
      desc: 'USGS NEIC automated ground-motion telemetry normalized into canonical stream.',
      icon: Activity,
    },
    {
      category: 'CORRELATION',
      label: 'Multi-Source Correlation Matched',
      timestamp: formatTimeOffset(14),
      desc: 'Cross-provider temporal & spatial similarity computed (Score: 0.96, MATCHED).',
      icon: ShieldCheck,
    },
    {
      category: 'ASSESSMENT',
      label: 'WorldPop Demographic Exposure Evaluated',
      timestamp: formatTimeOffset(22),
      desc: 'Interspersed empirical ground-motion perimeter against high-resolution demographic grid.',
      icon: Database,
    },
    {
      category: 'ASSESSMENT',
      label: 'Copernicus DEM Topographic Analysis',
      timestamp: formatTimeOffset(29),
      desc: 'Topographic slope analysis flagged elevated secondary terrain landslide susceptibility.',
      icon: AlertTriangle,
    },
    {
      category: 'INCIDENT',
      label: 'Incident Promoted to Operational Command',
      timestamp: formatTimeOffset(38),
      desc: 'Promoted to ACTIVE incident status with deterministic risk classification of CRITICAL.',
      icon: CheckCircle2,
    },
    {
      category: 'SYSTEM',
      label: 'Operational Command Dossier Assembled',
      timestamp: formatTimeOffset(45),
      desc: 'Decision-support intelligence dossier synchronized across operator workspace.',
      icon: Layers,
    },
  ];

  const getCategoryClass = (cat) => {
    switch (cat) {
      case 'OBSERVATION':
        return 'cat-observation';
      case 'CORRELATION':
        return 'cat-correlation';
      case 'ASSESSMENT':
        return 'cat-assessment';
      case 'INCIDENT':
        return 'cat-incident';
      case 'WARNING':
        return 'cat-warning';
      default:
        return 'cat-system';
    }
  };

  return (
    <div className="timeline-panel-content">
      <div className="timeline-header-strip">
        <Clock size={14} className="text-cyan" />
        <span className="section-title">INCIDENT LIFECYCLE AUDIT TRAIL</span>
      </div>

      <div className="timeline-trail">
        {TIMELINE_EVENTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="timeline-event-item">
              <div className="timeline-bullet-col">
                <span className="timeline-dot" />
                {idx < TIMELINE_EVENTS.length - 1 && <span className="timeline-line" />}
              </div>

              <div className="timeline-event-body">
                <div className="event-head-line">
                  <span className={`event-category-badge font-mono ${getCategoryClass(item.category)}`}>
                    [{item.category}]
                  </span>
                  <span className="event-title font-display">{item.label}</span>
                </div>

                <div className="event-time-line font-mono text-cyan">
                  {item.timestamp}
                </div>

                <p className="event-desc-text">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
