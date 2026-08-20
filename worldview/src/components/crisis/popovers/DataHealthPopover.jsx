import React from 'react';
import { Server, CheckCircle2, AlertTriangle, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import PopoverContainer from './PopoverContainer.jsx';

const PROVIDER_SPECS = [
  {
    id: 'USGS',
    name: 'USGS Earthquake Telemetry',
    tier: 'TIER_A',
    type: 'SEISMIC_TELEMETRY',
    status: 'HEALTHY',
    freshness: 'LIVE',
    dataState: 'OBSERVED',
    latency: '85ms',
    coverage: 'GLOBAL',
    notes: 'Direct GeoJSON feed from National Earthquake Information Center.',
  },
  {
    id: 'SACHET',
    name: 'SACHET / NDMA CAP 1.2',
    tier: 'TIER_A',
    type: 'OFFICIAL_ALERT',
    status: 'HEALTHY',
    freshness: 'LIVE',
    dataState: 'OBSERVED',
    latency: '140ms',
    coverage: 'INDIA',
    notes: 'Official Common Alerting Protocol emergency broadcast feed.',
  },
  {
    id: 'IMD',
    name: 'IMD Weather & Cyclone Bulletins',
    tier: 'TIER_A',
    type: 'METEOROLOGICAL',
    status: 'HEALTHY',
    freshness: 'LIVE',
    dataState: 'OBSERVED',
    latency: '210ms',
    coverage: 'SOUTH_ASIA',
    notes: 'Synoptic weather station readings & cyclone advisory track data.',
  },
  {
    id: 'FIRMS',
    name: 'NASA FIRMS VIIRS/MODIS',
    tier: 'TIER_B',
    type: 'THERMAL_HOTSPOTS',
    status: 'HEALTHY',
    freshness: 'RECENT',
    dataState: 'OBSERVED',
    latency: '3.2s',
    coverage: 'GLOBAL',
    notes: 'Near real-time thermal anomaly detections (375m VIIRS resolution).',
  },
  {
    id: 'OPENSKY',
    name: 'OpenSky ADSB Network',
    tier: 'TIER_B',
    type: 'FLIGHT_TRACKING',
    status: 'HEALTHY',
    freshness: 'LIVE',
    dataState: 'OBSERVED',
    latency: '450ms',
    coverage: 'GLOBAL_AIRSPACE',
    notes: 'Live transponder state vectors for airspace situational awareness.',
  },
  {
    id: 'CELESTRAK',
    name: 'CelesTrak NORAD Telemetry',
    tier: 'TIER_B',
    type: 'ORBITAL_EPHEMERIS',
    status: 'HEALTHY',
    freshness: 'LIVE',
    dataState: 'DERIVED',
    latency: '15ms (Worker)',
    coverage: 'LEO / GEO',
    notes: 'SGP4 orbital propagation worker for active earth observation satellites.',
  },
  {
    id: 'WORLDPOP',
    name: 'WorldPop Demographic Model',
    tier: 'TIER_B',
    type: 'POPULATION_EXPOSURE',
    status: 'HEALTHY',
    freshness: 'STATIC',
    dataState: 'STATIC',
    latency: '<5ms (Local)',
    coverage: 'GLOBAL_LAND',
    notes: 'High-resolution demographic distribution grid for exposure calculation.',
  },
  {
    id: 'COPERNICUS_DEM',
    name: 'Copernicus 30m DEM',
    tier: 'TIER_B',
    type: 'DIGITAL_ELEVATION',
    status: 'HEALTHY',
    freshness: 'STATIC',
    dataState: 'STATIC',
    latency: '<5ms (Local)',
    coverage: 'GLOBAL_LAND',
    notes: 'Digital elevation model for drainage basin slope & terrain slope derivation.',
  },
];

export default function DataHealthPopover({ onClose }) {
  return (
    <PopoverContainer
      title="DATA FABRIC & PROVIDER HEALTH"
      subtitle="Operational status of all upstream sensor networks & baseline models"
      icon={Server}
      onClose={onClose}
      width={420}
    >
      <div className="data-health-popover-body">
        <div className="health-summary-pill">
          <ShieldCheck size={14} className="text-green" />
          <span>ALL CONNECTED DATA FEEDS OPERATIONAL</span>
          <span className="health-count font-mono">8/8 ACTIVE</span>
        </div>

        <div className="provider-health-list">
          {PROVIDER_SPECS.map((prov) => (
            <div key={prov.id} className="provider-health-item">
              <div className="prov-header-row">
                <div className="prov-name-group">
                  <span className="prov-status-dot green" />
                  <span className="prov-title">{prov.name}</span>
                </div>
                <div className="prov-tags-group">
                  <span className={`prov-tier-badge ${prov.tier.toLowerCase()}`}>{prov.tier}</span>
                  <span className={`prov-state-badge state-${prov.dataState.toLowerCase()}`}>
                    {prov.dataState}
                  </span>
                </div>
              </div>

              <div className="prov-metrics-grid">
                <div className="prov-metric">
                  <span className="m-label">LATENCY</span>
                  <span className="m-val font-mono">{prov.latency}</span>
                </div>
                <div className="prov-metric">
                  <span className="m-label">COVERAGE</span>
                  <span className="m-val font-mono">{prov.coverage}</span>
                </div>
                <div className="prov-metric">
                  <span className="m-label">FRESHNESS</span>
                  <span className="m-val font-mono text-cyan">{prov.freshness}</span>
                </div>
              </div>

              <div className="prov-notes-text">
                {prov.notes}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PopoverContainer>
  );
}
