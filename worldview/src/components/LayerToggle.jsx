import { 
  Plane, 
  Orbit, 
  Ship, 
  Activity, 
  CloudSun, 
  ShieldAlert 
} from 'lucide-react';

const ICON_MAP = {
  flights: Plane,
  militaryFlights: ShieldAlert,
  earthquakes: Activity,
  satellites: Orbit,
  ships: Ship,
  weather: CloudSun,
};

export default function LayerToggle({ id, label, meta, active, count, onToggle }) {
  const IconComponent = ICON_MAP[id] || Activity;
  const displayCount = count != null ? (count > 999 ? (count/1000).toFixed(1) + 'K' : count) : '-';
  
  return (
    <div 
      className={`layer-row ${active ? 'active' : ''}`}
      onClick={onToggle}
    >
      <div className="layer-icon">
        <IconComponent size={16} strokeWidth={2} />
      </div>
      <div className="layer-info">
        <span className="layer-name">{label}</span>
        <span className="layer-source">{meta}</span>
      </div>
      <div className="layer-count">{displayCount}</div>
      <button 
        className={`toggle-btn ${active ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation(); // Prevent double toggle since row is clickable
          onToggle();
        }}
      >
        {active ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
