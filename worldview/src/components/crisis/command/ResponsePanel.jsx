import React from 'react';
import { CheckSquare, ShieldAlert, Building2, Plane, Navigation, Activity, Waves, Info } from 'lucide-react';

const RESPONSE_CHECKS = [
  {
    id: 'resp-01',
    objective: 'Assess healthcare & triage facility capacity',
    icon: Building2,
    why: 'Estimated population exposure in proximal shaking perimeter indicates potential for localized surge.',
    evidence: 'Demographic model and proximity of local regional clinics.',
    status: 'PRIORITY CHECK',
  },
  {
    id: 'resp-02',
    objective: 'Inspect runway integrity & aerodrome readiness',
    icon: Plane,
    why: 'Aviation runways within 35km envelope may experience surface fissures or instrumentation outage.',
    evidence: 'Airport coordinates within moderate ground motion zone.',
    status: 'CHECK REQUIRED',
  },
  {
    id: 'resp-03',
    objective: 'Check arterial road clearance & bridge viaducts',
    icon: Navigation,
    why: 'Elevated slope gradients (>14°) along arterial highways indicate potential for localized debris obstruction.',
    evidence: 'Copernicus 30m Digital Elevation Model.',
    status: 'SURVEILLANCE',
  },
  {
    id: 'resp-04',
    objective: 'Monitor aftershock decay & highway passes',
    icon: Activity,
    why: 'Shallow crustal events often generate substantial aftershock sequences (up to M6.5).',
    evidence: 'WorldView seismo-sequence empirical model.',
    status: 'MONITORING',
  },
  {
    id: 'resp-05',
    objective: 'Verify coastal sea-level & buoy telemetry',
    icon: Waves,
    why: 'Marine rupture proximity requires ongoing validation against official tsunami bulletins.',
    evidence: 'Coastal distance metric (<25km to shoreline).',
    status: 'ADVISORY',
  },
];

export default function ResponsePanel() {
  return (
    <div className="response-panel-content">
      <div className="response-intro-box">
        <Info size={14} className="text-cyan flex-shrink-0" />
        <p className="intro-text font-body">
          Operational decision support recommendations based on multi-source impact synthesis. 
          Specific emergency asset deployments must follow authoritative agency protocols.
        </p>
      </div>

      <div className="response-checklist">
        {RESPONSE_CHECKS.map((check) => {
          const Icon = check.icon;
          return (
            <div key={check.id} className="response-card">
              <div className="resp-card-head">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-cyan" />
                  <span className="resp-objective font-display">{check.objective}</span>
                </div>
                <span className="resp-status-pill font-mono">{check.status}</span>
              </div>

              <div className="resp-body font-body">
                <div className="resp-line">
                  <span className="resp-label font-mono">RATIONALE:</span>
                  <span className="resp-val">{check.why}</span>
                </div>
                <div className="resp-line">
                  <span className="resp-label font-mono">EVIDENCE:</span>
                  <span className="resp-val text-muted">{check.evidence}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
