import { useState, useEffect, useRef, useCallback } from 'react';
import { REGION_BOUNDS } from './useFlights';

const USGS_URL = '/api/earthquakes';
const USGS_DIRECT_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const REFRESH_MS = 300000; // 5 minutes
const CAP = 100;

const filterQuakesByBounds = (features, region) => {
  if (region === 'GLOBAL') return features;
  const b = REGION_BOUNDS[region];
  if (!b) return features;
  return features.filter(f => {
    const [lon, lat] = f.geometry.coordinates;
    return lat >= b.minLat && lat <= b.maxLat &&
           lon >= b.minLon && lon <= b.maxLon;
  });
};

export default function useEarthquakes(enabled, regionKey, _unused, staggerMs = 7000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchQuakes = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      let res;
      try {
        res = await fetch(USGS_URL);
        if (!res.ok) throw new Error();
      } catch (_e) {
        res = await fetch(USGS_DIRECT_URL);
      }
      if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
      const json = await res.json();
      let features = json.features || [];

      // Apply region bounding box filter
      features = filterQuakesByBounds(features, regionKey);

      features = features
        .sort((a, b) => (b.properties.mag || 0) - (a.properties.mag || 0))
        .slice(0, CAP);

      setData(
        features.map((f) => ({
          id: f.id,
          magnitude: f.properties.mag,
          place: f.properties.place,
          time: new Date(f.properties.time).toUTCString(),
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
          latitude: f.geometry.coordinates[1],
          depth: f.geometry.coordinates[2],
        }))
      );
      setError(null);
    } catch (err) {
      console.error('useEarthquakes error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled, regionKey]);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Clear data immediately on region change
    setData([]);

    const timeout = setTimeout(() => {
      fetchQuakes();
      intervalRef.current = setInterval(fetchQuakes, REFRESH_MS);
    }, staggerMs);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, staggerMs, fetchQuakes]);

  return { data, loading, error, refresh: fetchQuakes };
}
