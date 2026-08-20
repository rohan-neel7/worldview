import React from 'react';

const STATE_CONFIG = {
  LIVE: {
    color: 'var(--status-available)',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.3)',
    label: 'LIVE',
    dot: true,
    pulse: true,
    desc: 'Real-time authoritative feed with active continuous synchronization.',
  },
  RECENT: {
    color: 'var(--color-cyan)',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.3)',
    label: 'RECENT',
    dot: true,
    desc: 'Fresh observation telemetry within nominal operational latency window.',
  },
  OBSERVED: {
    color: 'var(--color-cyan-bright)',
    bg: 'rgba(6, 182, 212, 0.10)',
    border: 'rgba(6, 182, 212, 0.25)',
    label: 'OBSERVED',
    desc: 'Direct sensor instrument measurement or official field observation.',
  },
  MODELED: {
    color: '#a78bfa', // Lavender/Purple
    bg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.3)',
    label: 'MODELED',
    desc: 'Model-derived empirical or numerical simulation output.',
  },
  ESTIMATED: {
    color: 'var(--severity-high)', // Amber
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.3)',
    label: 'ESTIMATED',
    desc: 'Statistical approximation calculated from baseline demographic grids.',
  },
  DERIVED: {
    color: '#60a5fa', // Blue
    bg: 'rgba(96, 165, 250, 0.12)',
    border: 'rgba(96, 165, 250, 0.3)',
    label: 'DERIVED',
    desc: 'Computed spatial or geometric envelope derived from primary observations.',
  },
  STATIC: {
    color: 'rgba(255, 255, 255, 0.65)',
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.15)',
    label: 'STATIC BASELINE',
    desc: 'Pre-computed reference baseline dataset (e.g. elevation, population).',
  },
  PENDING: {
    color: 'var(--severity-moderate)', // Ochre/Yellow
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.3)',
    label: 'PENDING',
    desc: 'Calculation or multi-source corroboration in progress.',
  },
  PARTIAL: {
    color: 'var(--severity-moderate)',
    bg: 'rgba(234, 179, 8, 0.10)',
    border: 'rgba(234, 179, 8, 0.25)',
    label: 'PARTIAL',
    desc: 'Partial geographic or sensor coverage available for this event.',
  },
  UNAVAILABLE: {
    color: 'rgba(255, 255, 255, 0.45)',
    bg: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.10)',
    label: 'UNAVAILABLE',
    desc: 'Dataset or sensor feed unavailable for this specific geometry.',
  },
  UNASSESSED: {
    color: 'rgba(255, 255, 255, 0.45)',
    bg: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.10)',
    label: 'UNASSESSED',
    desc: 'Asset location mapped within zone; physical damage or status not yet surveyed.',
  },
};

export default function DataStateBadge({
  state = 'OBSERVED',
  label = null,
  size = 'sm',
  title = null,
  className = '',
}) {
  const normState = (state || 'OBSERVED').toUpperCase();
  const config = STATE_CONFIG[normState] || STATE_CONFIG.OBSERVED;
  const displayLabel = label || config.label;
  const tooltip = title || config.desc;

  const isSmall = size === 'sm';

  return (
    <span
      className={`data-state-badge font-mono inline-flex items-center gap-1 ${className}`}
      title={tooltip}
      style={{
        fontSize: isSmall ? '10px' : '11px',
        padding: isSmall ? '1px 5px' : '2px 8px',
        borderRadius: '3px',
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
        letterSpacing: '0.04em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {config.dot && (
        <span
          style={{
            width: isSmall ? '4px' : '5px',
            height: isSmall ? '4px' : '5px',
            borderRadius: '50%',
            backgroundColor: config.color,
            boxShadow: config.pulse ? `0 0 6px ${config.color}` : 'none',
          }}
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
