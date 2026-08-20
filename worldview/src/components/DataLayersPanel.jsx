import { useState, useMemo } from 'react';
import * as Cesium from 'cesium';
import { useWorldView } from '../WorldViewContext';
import LayerToggle from './LayerToggle';
import { Search, Radio, Navigation, Plane, Activity, Orbit, Ship, ShieldAlert } from 'lucide-react';

export default function DataLayersPanel({
  flightData = [],
  earthquakeData = [],
  satelliteData = [],
  shipData = [],
  viewer,
  onSelectFlight
}) {
  const {
    activeLayers,
    toggleLayer,
    LAYER_META,
    selectedRegion,
    setSelectedRegion,
    regionStats,
    REGIONS,
    enterIncidentMode,
    incidents,
    activeIncidentId,
  } = useWorldView();

  const [activeFeedTab, setActiveFeedTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Combine and normalize fetched items
  const feedItems = useMemo(() => {
    const items = [];

    if (activeLayers.earthquakes && earthquakeData?.length) {
      earthquakeData.slice(0, 30).forEach((q) => {
        const mag = q.magnitude || q.mag || 0;
        const isSignificant = mag >= 4.5;
        items.push({
          type: 'QUAKE',
          id: q.id || `${q.lat}-${q.lon}`,
          title: `M${mag.toFixed(1)} - ${q.place || 'SEISMIC EVENT'}`,
          subtitle: `DEPTH: ${q.depth || 10}km | ${q.time ? new Date(q.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'RECENT'}`,
          lat: q.lat || q.latitude,
          lon: q.lon || q.longitude,
          height: 350000,
          raw: q,
          isSignificant,
          isIncident: isSignificant,
        });
      });
    }

    if (activeLayers.flights && flightData?.length) {
      flightData.slice(0, 40).forEach((f) => {
        items.push({
          type: 'FLIGHT',
          id: f.icao24 || f.id,
          title: f.callsign || f.icao24 || 'FLIGHT',
          subtitle: `ALT: ${Math.round(f.altitude || f.alt || 0)}m | SPD: ${Math.round(f.velocity || 0)}kts`,
          lat: f.lat || f.latitude,
          lon: f.lon || f.longitude,
          height: 25000,
          raw: f,
        });
      });
    }

    if (activeLayers.satellites && satelliteData?.length) {
      satelliteData.slice(0, 40).forEach((s) => {
        items.push({
          type: 'SAT',
          id: s.name,
          title: s.name,
          subtitle: `ORBIT: ${Math.round(s.alt || 400)}km LEO`,
          lat: s.lat,
          lon: s.lon,
          height: ((s.alt || 400) * 1000) + 1500000,
          raw: s,
        });
      });
    }

    if (activeLayers.ships && shipData?.length) {
      shipData.slice(0, 40).forEach((v) => {
        items.push({
          type: 'SHIP',
          id: v.mmsi || v.id,
          title: v.name || `MMSI: ${v.mmsi}`,
          subtitle: `TYPE: ${v.shipType || 'Vessel'} | SPD: ${Math.round(v.speed || 0)}kts`,
          lat: v.lat,
          lon: v.lon,
          height: 50000,
          raw: v,
        });
      });
    }

    return items;
  }, [activeLayers, flightData, earthquakeData, satelliteData, shipData]);

  // Filter items by active tab and search text
  const filteredFeed = useMemo(() => {
    return feedItems.filter((item) => {
      if (activeFeedTab === 'FLIGHTS' && item.type !== 'FLIGHT') return false;
      if (activeFeedTab === 'QUAKES' && item.type !== 'QUAKE') return false;
      if (activeFeedTab === 'SATS' && item.type !== 'SAT') return false;
      if (activeFeedTab === 'SHIPS' && item.type !== 'SHIP') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [feedItems, activeFeedTab, searchQuery]);

  const handleTargetClick = (item) => {
    if (item.type === 'FLIGHT' && onSelectFlight) {
      onSelectFlight(item.raw);
      return;
    }

    if (item.type === 'QUAKE' && item.isSignificant && enterIncidentMode) {
      // Find matching incident
      const inc = (incidents || []).find((i) =>
        i.correlatedEventIds?.some((cid) => cid.includes(item.id)) ||
        (Math.abs(i.location?.lat - item.lat) < 0.1 && Math.abs(i.location?.lon - item.lon) < 0.1)
      );
      if (inc) {
        enterIncidentMode(inc.id);
      } else {
        enterIncidentMode(`hyp-earthquake-usgs_${item.id}`);
      }
      return;
    }

    if (!viewer || viewer.isDestroyed() || !item.lat || !item.lon) return;
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, item.height || 100000),
        duration: 2.0,
      });
    } catch (e) {
      console.warn('Camera flyTo failed:', e);
    }
  };

  return (
    <div className="data-layers-panel">
      {/* ── Region Selector ── */}
      <div className="section-header">
        <div className="section-title">THEATER SELECTOR</div>
        <div className="section-line"></div>
      </div>
      
      <div className="region-selector-container">
        {Object.keys(REGIONS).map((key) => (
          <button
            key={key}
            onClick={() => setSelectedRegion(key)}
            className={`region-btn ${selectedRegion === key ? 'active' : ''}`}
          >
            {REGIONS[key].name}
          </button>
        ))}
      </div>

      <div className="region-stats-container">
        <div className="stat-item">
          <span className="stat-item-label">FLIGHTS</span>
          <span className="stat-item-value">{regionStats.flights}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-label">QUAKES</span>
          <span className="stat-item-value">{regionStats.quakes}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-label">SATS</span>
          <span className="stat-item-value">{regionStats.sats}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-label">SHIPS</span>
          <span className="stat-item-value">{regionStats.ships}</span>
        </div>
      </div>

      {/* ── Layer Toggles ── */}
      <div className="section-header">
        <div className="section-title">SURVEILLANCE LAYERS</div>
        <div className="section-line"></div>
      </div>

      <div className="layer-list-container">
        {Object.entries(LAYER_META).map(([id, meta]) => (
          <LayerToggle
            key={id}
            id={id}
            label={meta.label}
            meta={`${meta.source} // ${meta.interval}`}
            active={activeLayers[id]}
            count={
              id === 'flights' ? regionStats.flights : 
              id === 'earthquakes' ? regionStats.quakes : 
              id === 'satellites' ? regionStats.sats : 
              id === 'ships' ? regionStats.ships : 
              null
            }
            onToggle={() => toggleLayer(id)}
          />
        ))}
      </div>

      {/* ── Live Fetched Data Feed (Left Sidebar) ── */}
      <div className="section-header" style={{ marginTop: '16px' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={12} color="var(--color-cyan)" className="animate-pulse" />
          TARGET STREAM ({filteredFeed.length})
        </div>
        <div className="section-line"></div>
      </div>

      <div className="live-feed-container">
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="feed-search-input"
            placeholder="FILTER MONITORED TARGETS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
        </div>

        {/* Feed Category Tabs */}
        <div className="feed-tabs">
          {['ALL', 'QUAKES', 'FLIGHTS', 'SATS', 'SHIPS'].map((tab) => (
            <button
              key={tab}
              className={`feed-tab-btn ${activeFeedTab === tab ? 'active' : ''}`}
              onClick={() => setActiveFeedTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Scrollable Data List */}
        <div className="feed-list">
          {filteredFeed.length === 0 ? (
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', padding: '12px 4px', textAlign: 'center' }}>
              NO MONITORED TARGETS MATCHING CRITERIA
            </div>
          ) : (
            filteredFeed.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className={`feed-item-card ${item.isIncident ? 'incident-target-card' : ''}`}
                onClick={() => handleTargetClick(item)}
                title={item.isIncident ? 'Click to launch Incident Command Mode' : 'Click to locate on 3D globe'}
              >
                <div className="feed-item-header">
                  <span className="feed-item-title">{item.title}</span>
                  {item.isIncident ? (
                    <span className="feed-item-badge incident-badge">
                      <ShieldAlert size={10} style={{ display: 'inline', marginRight: '2px' }} />
                      INCIDENT
                    </span>
                  ) : (
                    <span className={`feed-item-badge ${item.type === 'QUAKE' ? 'quake' : ''}`}>
                      {item.type}
                    </span>
                  )}
                </div>
                <div className="feed-item-sub">
                  <span>{item.subtitle}</span>
                  <Navigation size={10} color="var(--color-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
