import React from 'react';
import { 
  X, 
  Eye, 
  Layers, 
  MapPin, 
  Sun, 
  Move, 
  Camera, 
  RefreshCw, 
  Sliders,
  Crosshair,
  Layout
} from 'lucide-react';
import { useWorldView } from '../../WorldViewContext.jsx';
import StylePresetsPanel from '../StylePresetsPanel.jsx';
import LocationsPanel from '../LocationsPanel.jsx';

export default function ViewSettingsDrawer({
  isOpen,
  onClose,
  viewer: _viewer,
  bloomEnabled,
  onToggleBloom,
  sharpenValue,
  onSharpenChange,
  isPanning,
  onToggleRotationLock,
  onScreenshot,
  onResetView,
}) {
  const {
    showHUD,
    setShowHUD,
  } = useWorldView();

  if (!isOpen) return null;

  return (
    <div className="view-settings-drawer-overlay" onClick={onClose}>
      <aside 
        className="view-settings-drawer-panel p-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        aria-label="World View Settings"
      >
        {/* Drawer Header */}
        <div className="drawer-header flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-cyan" />
            <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider">VIEW SETTINGS & DISPLAY MODES</h3>
          </div>
          <button 
            className="p-1 rounded text-muted hover:text-white"
            onClick={onClose}
            aria-label="Close View Settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Section 1: Shader Styles */}
        <div className="drawer-section flex flex-col gap-2">
          <div className="flex items-center gap-1.5 font-display text-xs font-semibold text-cyan uppercase">
            <Eye size={13} />
            <span>OPTICAL PRESETS (POST-PROCESSING)</span>
          </div>
          <StylePresetsPanel />
        </div>

        {/* Section 2: Regional Theaters */}
        <div className="drawer-section flex flex-col gap-2">
          <div className="flex items-center gap-1.5 font-display text-xs font-semibold text-cyan uppercase">
            <MapPin size={13} />
            <span>REGIONAL SURVEILLANCE THEATERS</span>
          </div>
          <LocationsPanel />
        </div>

        {/* Section 3: Visual & Atmospheric Controls */}
        <div className="drawer-section flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 font-display text-xs font-semibold text-cyan uppercase">
            <Layers size={13} />
            <span>ATMOSPHERIC & SENSOR CONTROLS</span>
          </div>

          <div className="flex items-center justify-between text-xs font-body">
            <span className="text-muted">ROTATION LOCK:</span>
            <button
              className="px-2.5 py-1 rounded font-mono text-xs"
              style={{ background: isPanning ? 'rgba(6, 182, 212, 0.2)' : 'var(--surface-l3)', border: '1px solid var(--border-subtle)', color: isPanning ? 'var(--color-cyan)' : 'white' }}
              onClick={onToggleRotationLock}
            >
              <Move size={12} className="inline mr-1" />
              {isPanning ? 'UNLOCKED' : 'LOCKED'}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-body">
            <span className="text-muted">ATMOSPHERIC BLOOM:</span>
            <button
              className="px-2.5 py-1 rounded font-mono text-xs"
              style={{ background: bloomEnabled ? 'rgba(6, 182, 212, 0.2)' : 'var(--surface-l3)', border: '1px solid var(--border-subtle)', color: bloomEnabled ? 'var(--color-cyan)' : 'white' }}
              onClick={onToggleBloom}
            >
              <Sun size={12} className="inline mr-1" />
              {bloomEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div className="flex flex-col gap-1 text-xs font-body">
            <div className="flex justify-between text-muted">
              <span>SENSOR SHARPEN:</span>
              <span className="font-mono text-cyan">{sharpenValue}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sharpenValue}
              onChange={onSharpenChange}
              className="vc-slider w-full"
            />
          </div>

          <div className="flex items-center justify-between text-xs font-body">
            <span className="text-muted">HUD OVERLAY:</span>
            <button
              className="px-2.5 py-1 rounded font-mono text-xs"
              style={{ background: showHUD ? 'rgba(6, 182, 212, 0.2)' : 'var(--surface-l3)', border: '1px solid var(--border-subtle)', color: showHUD ? 'var(--color-cyan)' : 'white' }}
              onClick={() => setShowHUD(!showHUD)}
            >
              <Crosshair size={12} className="inline mr-1" />
              {showHUD ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </div>
        </div>

        {/* Section 4: Capture & Reset Actions */}
        <div className="drawer-section grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
          <button 
            className="flex items-center justify-center gap-1.5 p-2 rounded text-xs font-display font-semibold text-white hover:bg-white/10"
            style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}
            onClick={onScreenshot}
          >
            <Camera size={13} className="text-cyan" />
            <span>SAVE FRAME</span>
          </button>

          <button 
            className="flex items-center justify-center gap-1.5 p-2 rounded text-xs font-display font-semibold text-white hover:bg-white/10"
            style={{ background: 'var(--surface-l2)', border: '1px solid var(--border-subtle)' }}
            onClick={onResetView}
          >
            <RefreshCw size={13} className="text-cyan" />
            <span>RECENTER GLOBE</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
