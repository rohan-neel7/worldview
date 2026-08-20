import React from 'react';
import { Building2, Plane, Anchor, Navigation, MapPin, CheckSquare, Compass, Info, ShieldAlert } from 'lucide-react';
import PopoverContainer from './PopoverContainer.jsx';
import DataStateBadge from '../../common/DataStateBadge.jsx';
import { globalCameraController } from '../../../engine/camera/CentralizedCameraController.js';

export default function AssetDetailPopover({ asset, onClose }) {
  if (!asset) return null;

  const name = asset.name || 'Exposed Infrastructure Asset';
  const type = (asset.assetType || asset.type || 'INFRASTRUCTURE').toUpperCase();
  const distanceKm = typeof asset.distanceKm === 'number' ? asset.distanceKm.toFixed(1) : null;
  const intensity = asset.intensity || asset.zone || 'Moderate Shaking Perimeter';
  const lat = asset.lat != null ? Number(asset.lat).toFixed(4) : 'UNAVAILABLE';
  const lon = asset.lon != null ? Number(asset.lon).toFixed(4) : 'UNAVAILABLE';

  const getAssetIcon = () => {
    switch (type) {
      case 'HOSPITAL':
      case 'HEALTHCARE':
        return Building2;
      case 'AIRPORT':
      case 'RUNWAY':
        return Plane;
      case 'PORT':
      case 'MARITIME':
        return Anchor;
      default:
        return Navigation;
    }
  };

  const getDirectives = () => {
    switch (type) {
      case 'HOSPITAL':
      case 'HEALTHCARE':
        return [
          'Verify emergency generator and backup power status',
          'Assess structural integrity of emergency and triage wings',
          'Check municipal water and oxygen pressure lines',
        ];
      case 'AIRPORT':
      case 'RUNWAY':
        return [
          'Inspect runway pavement for surface rupture or fissures',
          'Check ATC radar & instrument landing system power',
          'Assess apron clearance for humanitarian relief aircraft',
        ];
      case 'PORT':
      case 'MARITIME':
        return [
          'Monitor tidal gauges for localized sea-level surges',
          'Inspect container crane stability and berth bulkheads',
          'Check navigation channels for bathymetric shifts',
        ];
      default:
        return [
          'Survey roadway clearance and overpass bridge integrity',
          'Check for slope debris obstruction along arterial routes',
          'Identify secondary relief corridor bypasses',
        ];
    }
  };

  const handleFlyTo = () => {
    if (asset.lat != null && asset.lon != null) {
      globalCameraController.flyToAsset(asset, asset.lon, 28000);
    }
  };

  return (
    <PopoverContainer
      title={name}
      subtitle={`Exposed ${type} infrastructure within impact perimeter`}
      icon={getAssetIcon()}
      onClose={onClose}
      width={410}
    >
      <div className="asset-popover-body flex flex-col gap-3">
        {/* ── 1. Geographic Location & Context ── */}
        <div className="p-2.5 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono text-muted uppercase font-semibold">GEOGRAPHIC LOCATION</span>
            <DataStateBadge state="STATIC" label="BASELINE" size="sm" />
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs text-white">
            <MapPin size={13} className="text-cyan flex-shrink-0" />
            <span>LAT: {lat}°, LON: {lon}°</span>
          </div>
        </div>

        {/* ── 2. Relation to Incident & Exposure ── */}
        <div className="grid grid-cols-2 gap-2 text-xs font-body">
          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>EPICENTRAL DISTANCE</div>
            <div className="font-display font-bold text-cyan text-sm mt-0.5">
              {distanceKm != null ? `${distanceKm} km` : 'UNAVAILABLE'}
            </div>
          </div>

          <div className="p-2 rounded" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
            <div className="font-mono text-muted uppercase" style={{ fontSize: '10px' }}>EXPOSURE ZONE</div>
            <div className="font-display font-semibold text-orange text-xs mt-0.5 truncate">
              {intensity}
            </div>
          </div>
        </div>

        {/* ── 3. Operational Damage & Status Guard (Never Fabricated) ── */}
        <div className="p-2.5 rounded flex flex-col gap-1.5" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted uppercase font-semibold">OPERATIONAL STATUS</span>
            <DataStateBadge state="UNASSESSED" size="sm" />
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs font-body">
            <div>
              <span className="text-muted block font-mono" style={{ fontSize: '10px' }}>PHYSICAL DAMAGE:</span>
              <span className="text-muted italic">UNASSESSED</span>
            </div>
            <div>
              <span className="text-muted block font-mono" style={{ fontSize: '10px' }}>FUNCTIONAL STATUS:</span>
              <span className="text-muted italic">UNASSESSED</span>
            </div>
          </div>

          <p className="font-body text-xs text-muted border-t border-white/5 pt-1 mt-0.5 leading-tight">
            Asset is located within calculated ground-motion envelope. On-site structural condition has not yet been reported by field observers.
          </p>
        </div>

        {/* ── 4. Recommended Priority Inspection Directives ── */}
        <div className="p-2.5 rounded flex flex-col gap-1.5" style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-display font-semibold text-cyan uppercase">
            PRIORITY INSPECTION CHECKLIST
          </div>
          <div className="flex flex-col gap-1 text-xs font-body">
            {getDirectives().map((dir, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-white">
                <CheckSquare size={12} className="text-cyan flex-shrink-0 mt-0.5" />
                <span>{dir}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. Provenance & Action Button ── */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs font-mono text-muted" style={{ fontSize: '10px' }}>
            SOURCE: OpenStreetMap Baseline
          </div>

          <button 
            className="flex items-center gap-1 px-3 py-1.5 rounded font-display font-semibold text-xs text-cyan hover:text-white"
            style={{ background: 'rgba(6, 182, 212, 0.12)', border: '1px solid var(--color-cyan)' }}
            onClick={handleFlyTo}
            title="Orient globe camera to asset"
          >
            <Compass size={13} />
            <span>ORIENT CAMERA</span>
          </button>
        </div>
      </div>
    </PopoverContainer>
  );
}
