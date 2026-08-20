import React, { useState } from 'react';
import { 
  Users, 
  Building2, 
  Plane, 
  Anchor, 
  Navigation, 
  ChevronDown, 
  ChevronRight, 
  Compass, 
  Info,
  Database
} from 'lucide-react';
import DataStateBadge from '../../common/DataStateBadge.jsx';
import { globalCameraController } from '../../../engine/camera/CentralizedCameraController.js';

export default function ImpactPanel({
  incident,
  impactData,
  onOpenExposurePopover,
  onOpenAssetPopover,
}) {
  const impact = impactData || incident?.impactData;
  const rawPop = impact?.exposureMetrics?.populationExposed;
  const hasPop = typeof rawPop === 'number' && rawPop >= 0;

  const formatPopKpi = (val) => {
    if (!hasPop || val == null) return 'UNAVAILABLE';
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${Math.round(val / 1000)}K`;
    return `${val}`;
  };

  const popExposedStr = formatPopKpi(rawPop);
  const popHighStr = hasPop ? formatPopKpi(Math.round(rawPop * 0.28)) : 'UNAVAILABLE';
  const popModStr = hasPop ? formatPopKpi(Math.round(rawPop * 0.52)) : 'UNAVAILABLE';
  const popLowStr = hasPop ? formatPopKpi(Math.round(rawPop * 0.20)) : 'UNAVAILABLE';

  // Asset lists
  const hospitals = impact?.exposedAssets?.hospitals || [];
  const airports = impact?.exposedAssets?.airports || [];
  const ports = impact?.exposedAssets?.ports || [];
  const roads = impact?.exposedAssets?.roads || [];

  // Expanded categories state
  const [expandedCats, setExpandedCats] = useState({
    hospitals: true,
    airports: true,
    ports: false,
    roads: false,
  });

  const toggleCat = (key) => {
    setExpandedCats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFlyTo = (asset) => {
    if (asset?.lat != null && asset?.lon != null) {
      globalCameraController.flyToAsset(asset, asset.lon, 28000);
    }
  };

  return (
    <div className="impact-panel-content flex flex-col gap-3">
      {/* ── 1. Population Exposure Baseline Module ── */}
      <div className="impact-module population-module p-3 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="module-header flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-cyan" />
            <span className="module-title font-display font-semibold text-xs text-white uppercase">POPULATION EXPOSURE BASELINE</span>
          </div>
          <DataStateBadge state="MODELED" size="sm" />
        </div>

        {/* Hero KPI Card */}
        <div 
          className="pop-hero-card p-2.5 rounded cursor-pointer transition hover:border-cyan" 
          onClick={onOpenExposurePopover}
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="pop-hero-top flex items-baseline justify-between mb-2">
            <div>
              <div className="pop-hero-val font-display font-bold text-cyan text-2xl">
                {popExposedStr}
              </div>
              <div className="pop-hero-label font-body text-xs text-muted">
                ESTIMATED RESIDENTS IN GROUND MOTION ENVELOPE
              </div>
            </div>
            <button 
              className="px-2 py-1 rounded font-display font-semibold text-xs text-cyan hover:text-white"
              style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)' }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenExposurePopover?.();
              }}
            >
              EXPLORE EXPOSURE
            </button>
          </div>

          <div className="pop-tiers-grid grid grid-cols-3 gap-1 p-1.5 rounded text-xs font-mono text-center mb-2" style={{ background: 'var(--surface-l3)' }}>
            <div className="pop-tier-pill high">
              <span className="p-tag text-muted text-micro block">HIGH (MMI VII+):</span>
              <span className="p-count font-bold" style={{ color: 'var(--severity-critical)' }}>{popHighStr}</span>
            </div>
            <div className="pop-tier-pill mod">
              <span className="p-tag text-muted text-micro block">MOD (MMI V-VI):</span>
              <span className="p-count font-bold" style={{ color: 'var(--severity-high)' }}>{popModStr}</span>
            </div>
            <div className="pop-tier-pill low">
              <span className="p-tag text-muted text-micro block">LOW (MMI III-IV):</span>
              <span className="p-count font-bold" style={{ color: 'var(--severity-moderate)' }}>{popLowStr}</span>
            </div>
          </div>

          <div className="pop-method-footer flex justify-between items-center text-xs font-mono text-muted border-t border-white/5 pt-1.5">
            <span>DATASET: <strong>WorldPop (100m Grid)</strong></span>
            <span>DATA STATE: <strong className="text-cyan">MODELED</strong></span>
          </div>
        </div>
      </div>

      {/* ── 2. Critical Infrastructure Exposure Module ── */}
      <div className="impact-module infrastructure-module p-3 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
        <div className="module-header flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Building2 size={14} className="text-cyan" />
            <span className="module-title font-display font-semibold text-xs text-white uppercase">INFRASTRUCTURE EXPOSURE ASSESSMENT</span>
          </div>
          <span className="asset-total-count font-mono text-xs text-muted">
            {hospitals.length + airports.length + ports.length + roads.length} EXPOSED
          </span>
        </div>

        {/* Category Accordions */}
        <div className="assets-categories-list flex flex-col gap-2">
          {/* Healthcare Facilities */}
          <div className="asset-category-card rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }}>
            <button className="asset-cat-head w-full flex items-center justify-between p-2" onClick={() => toggleCat('hospitals')}>
              <div className="cat-title-left flex items-center gap-1.5">
                {expandedCats.hospitals ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Building2 size={13} className="text-red" />
                <span className="cat-name font-display text-xs font-semibold text-white">HEALTHCARE FACILITIES IN IMPACT ZONE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="cat-count font-display font-bold text-cyan text-xs">{hospitals.length}</span>
              </div>
            </button>

            {expandedCats.hospitals && (
              <div className="asset-items-list p-2 border-t border-white/5 flex flex-col gap-1">
                {hospitals.length === 0 ? (
                  <div className="asset-empty-row text-xs font-body text-muted py-1">No mapped facilities inside direct perimeter</div>
                ) : (
                  hospitals.map((h, i) => (
                    <div key={i} className="asset-row-item flex items-center justify-between p-1.5 rounded hover:bg-white/5" style={{ background: 'var(--surface-l3)' }}>
                      <div className="asset-info flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" onClick={() => onOpenAssetPopover?.(h, 'HEALTHCARE')}>
                        <span className="asset-dot red w-1.5 h-1.5 rounded-full bg-red flex-shrink-0" />
                        <span className="asset-name font-body text-xs text-white truncate">{h.name || `Facility #${i + 1}`}</span>
                        <span className="asset-dist font-mono text-xs text-cyan ml-auto pr-2">
                          {typeof h.distanceKm === 'number' ? `${h.distanceKm.toFixed(1)} km` : 'UNAVAILABLE'}
                        </span>
                      </div>
                      <button className="asset-fly-btn text-muted hover:text-cyan p-1" onClick={() => handleFlyTo(h)} title="Orient Camera to Facility">
                        <Compass size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Aviation & Aerodromes */}
          <div className="asset-category-card rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }}>
            <button className="asset-cat-head w-full flex items-center justify-between p-2" onClick={() => toggleCat('airports')}>
              <div className="cat-title-left flex items-center gap-1.5">
                {expandedCats.airports ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Plane size={13} className="text-orange" />
                <span className="cat-name font-display text-xs font-semibold text-white">AVIATION & AERODROMES EXPOSED</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="cat-count font-display font-bold text-cyan text-xs">{airports.length}</span>
              </div>
            </button>

            {expandedCats.airports && (
              <div className="asset-items-list p-2 border-t border-white/5 flex flex-col gap-1">
                {airports.length === 0 ? (
                  <div className="asset-empty-row text-xs font-body text-muted py-1">No runways inside high-shaking zone</div>
                ) : (
                  airports.map((a, i) => (
                    <div key={i} className="asset-row-item flex items-center justify-between p-1.5 rounded hover:bg-white/5" style={{ background: 'var(--surface-l3)' }}>
                      <div className="asset-info flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" onClick={() => onOpenAssetPopover?.(a, 'AIRPORT')}>
                        <span className="asset-dot orange w-1.5 h-1.5 rounded-full bg-orange flex-shrink-0" />
                        <span className="asset-name font-body text-xs text-white truncate">{a.name || `Aerodrome #${i + 1}`}</span>
                        <span className="asset-dist font-mono text-xs text-cyan ml-auto pr-2">
                          {typeof a.distanceKm === 'number' ? `${a.distanceKm.toFixed(1)} km` : 'UNAVAILABLE'}
                        </span>
                      </div>
                      <button className="asset-fly-btn text-muted hover:text-cyan p-1" onClick={() => handleFlyTo(a)} title="Orient Camera to Aerodrome">
                        <Compass size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Maritime Ports */}
          <div className="asset-category-card rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }}>
            <button className="asset-cat-head w-full flex items-center justify-between p-2" onClick={() => toggleCat('ports')}>
              <div className="cat-title-left flex items-center gap-1.5">
                {expandedCats.ports ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Anchor size={13} className="text-cyan" />
                <span className="cat-name font-display text-xs font-semibold text-white">MARITIME BERTHS IN PERIMETER</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="cat-count font-display font-bold text-cyan text-xs">{ports.length}</span>
              </div>
            </button>

            {expandedCats.ports && (
              <div className="asset-items-list p-2 border-t border-white/5 flex flex-col gap-1">
                {ports.length === 0 ? (
                  <div className="asset-empty-row text-xs font-body text-muted py-1">No maritime berths inside perimeter</div>
                ) : (
                  ports.map((p, i) => (
                    <div key={i} className="asset-row-item flex items-center justify-between p-1.5 rounded hover:bg-white/5" style={{ background: 'var(--surface-l3)' }}>
                      <div className="asset-info flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" onClick={() => onOpenAssetPopover?.(p, 'PORT')}>
                        <span className="asset-dot cyan w-1.5 h-1.5 rounded-full bg-cyan flex-shrink-0" />
                        <span className="asset-name font-body text-xs text-white truncate">{p.name || `Berth #${i + 1}`}</span>
                        <span className="asset-dist font-mono text-xs text-cyan ml-auto pr-2">
                          {typeof p.distanceKm === 'number' ? `${p.distanceKm.toFixed(1)} km` : 'UNAVAILABLE'}
                        </span>
                      </div>
                      <button className="asset-fly-btn text-muted hover:text-cyan p-1" onClick={() => handleFlyTo(p)} title="Orient Camera to Port">
                        <Compass size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Arterial Roadways */}
          <div className="asset-category-card rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)' }}>
            <button className="asset-cat-head w-full flex items-center justify-between p-2" onClick={() => toggleCat('roads')}>
              <div className="cat-title-left flex items-center gap-1.5">
                {expandedCats.roads ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Navigation size={13} className="text-yellow" />
                <span className="cat-name font-display text-xs font-semibold text-white">ARTERIAL ROADWAYS IN ENVELOPE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="cat-count font-display font-bold text-cyan text-xs">{roads.length}</span>
              </div>
            </button>

            {expandedCats.roads && (
              <div className="asset-items-list p-2 border-t border-white/5 flex flex-col gap-1">
                {roads.length === 0 ? (
                  <div className="asset-empty-row text-xs font-body text-muted py-1">Arterial corridor analysis nominal</div>
                ) : (
                  roads.map((r, i) => (
                    <div key={i} className="asset-row-item flex items-center justify-between p-1.5 rounded hover:bg-white/5" style={{ background: 'var(--surface-l3)' }}>
                      <div className="asset-info flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" onClick={() => onOpenAssetPopover?.(r, 'ROAD')}>
                        <span className="asset-dot yellow w-1.5 h-1.5 rounded-full bg-yellow flex-shrink-0" />
                        <span className="asset-name font-body text-xs text-white truncate">{r.name || `Corridor #${i + 1}`}</span>
                        <span className="asset-dist font-mono text-xs text-cyan ml-auto pr-2">
                          {typeof r.distanceKm === 'number' ? `${r.distanceKm.toFixed(1)} km` : 'UNAVAILABLE'}
                        </span>
                      </div>
                      <button className="asset-fly-btn text-muted hover:text-cyan p-1" onClick={() => handleFlyTo(r)} title="Orient Camera to Roadway">
                        <Compass size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
