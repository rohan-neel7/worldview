import { useCallback } from 'react';

const LOCATIONS = [
  { name: 'Global', lon: 77.5946, lat: 12.9716, alt: 20000000 },
  { name: 'London', lon: -0.1276, lat: 51.5074, alt: 100000 },
  { name: 'Washington DC', lon: -77.0369, lat: 38.9072, alt: 100000 },
  { name: 'Tokyo', lon: 139.6917, lat: 35.6895, alt: 100000 },
  { name: 'Bengaluru', lon: 77.5946, lat: 12.9716, alt: 100000 },
  { name: 'Moscow', lon: 37.6173, lat: 55.7558, alt: 100000 },
];

export default function LocationsPanel() {
  const handleFlyTo = useCallback((loc) => {
    const viewerElement = document.getElementById('cesium-container');
    if (viewerElement && viewerElement.__flyTo) {
      viewerElement.__flyTo(loc.lon, loc.lat, loc.alt);
    }
  }, []);

  return (
    <div className="pill-grid">
      {LOCATIONS.map((loc) => (
        <button
          key={loc.name}
          className="pill-btn"
          onClick={() => handleFlyTo(loc)}
        >
          {loc.name}
        </button>
      ))}
    </div>
  );
}
