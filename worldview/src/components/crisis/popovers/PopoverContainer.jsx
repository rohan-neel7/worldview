import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function PopoverContainer({
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  width = 380,
}) {
  const containerRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap / auto-focus on open
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div 
      className="contextual-popover-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="popover-title"
    >
      <div 
        ref={containerRef}
        className="contextual-popover-card" 
        style={{ width: `min(${width}px, 92vw)` }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Popover Header */}
        <div className="popover-header">
          <div className="popover-title-group">
            {Icon && <Icon size={16} className="popover-header-icon" />}
            <div>
              <h3 id="popover-title" className="popover-title">{title}</h3>
              {subtitle && <p className="popover-subtitle">{subtitle}</p>}
            </div>
          </div>

          <button 
            className="popover-close-btn" 
            onClick={onClose}
            aria-label="Close Popover (Escape)"
            title="Close (Escape)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Popover Body Content */}
        <div className="popover-content">
          {children}
        </div>
      </div>
    </div>
  );
}
