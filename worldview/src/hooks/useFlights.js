import { useState, useEffect, useRef, useCallback } from 'react';

const REFRESH_MS = 10000; // 10 seconds

export const REGION_BOUNDS = {
  AMERICAS: { minLat: -60, maxLat: 75, minLon: -170, maxLon: -30 },
  EUROPE: { minLat: 35, maxLat: 72, minLon: -15, maxLon: 45 },
  ASIA_PACIFIC: { minLat: -50, maxLat: 55, minLon: 60, maxLon: 180 },
  MIDDLE_EAST: { minLat: 12, maxLat: 42, minLon: 25, maxLon: 63 },
  AFRICA: { minLat: -35, maxLat: 38, minLon: -20, maxLon: 52 },
};

const filterByBounds = (aircraft, region) => {
  if (!region || region === 'GLOBAL') {
    return aircraft.slice(0, 35);
  }
  const b = REGION_BOUNDS[region];
  if (!b) return aircraft.slice(0, 50);
  return aircraft.filter(a =>
    a.lat >= b.minLat && a.lat <= b.maxLat &&
    a.lon >= b.minLon && a.lon <= b.maxLon
  );
};

async function fetchOpenSkyFlights(regionKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    let res;
    try {
      res = await fetch(`/api/flights?region=${encodeURIComponent(regionKey || 'GLOBAL')}`, { signal: controller.signal });
    } catch (_e) {
      res = await fetch('https://opensky-network.org/api/states/all', { signal: controller.signal });
    }
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
    const data = await res.json();
    const states = data.states || [];

    const parsed = states
      .filter(s => s[5] != null && s[6] != null && !s[8])
      .map(s => ({
        id: s[0],
        icao24: s[0],
        callsign: (s[1] || s[0]).trim(),
        latitude: s[6],
        lat: s[6],
        longitude: s[5],
        lon: s[5],
        altitude: s[7] || 10000,
        alt: s[7] || 10000,
        heading: s[10] || 0,
        velocity: Math.round((s[9] || 0) * 1.94384),
        country: s[2] || 'Global'
      }));

    const bounded = filterByBounds(parsed, regionKey);
    const cap = regionKey === 'GLOBAL' ? 35 : 100;
    return bounded.slice(0, cap);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchStaticFallbackFlights(regionKey) {
  const res = await fetch('/data/active-flights.json');
  if (!res.ok) throw new Error('Static fallback load failed');
  const data = await res.json();
  const bounded = filterByBounds(data, regionKey);
  const cap = regionKey === 'GLOBAL' ? 35 : 100;
  return bounded.slice(0, cap);
}

async function fetchFlightsApi(regionKey) {
  try {
    const openSkyFlights = await fetchOpenSkyFlights(regionKey);
    if (Array.isArray(openSkyFlights) && openSkyFlights.length > 0) {
      return openSkyFlights;
    }
  } catch (e) {
    console.warn('[useFlights] OpenSky API offline/throttled, using static backup:', e.message);
  }

  try {
    const staticFlights = await fetchStaticFallbackFlights(regionKey);
    return staticFlights;
  } catch (e) {
    console.error('[useFlights] All flight sources failed:', e.message);
    return [];
  }
}

export default function useFlights(enabled, regionKey) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchFlights = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const flights = await fetchFlightsApi(regionKey);
      setData(flights);
      setError(null);
    } catch (err) {
      console.error('[useFlights] Critical error:', err);
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

    setData([]);

    const start = () => {
      fetchFlights();
      intervalRef.current = setInterval(fetchFlights, REFRESH_MS);
    };

    const timeout = setTimeout(start, 0);
    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, regionKey, fetchFlights]);

  return { data, loading, error, refresh: fetchFlights };
}
