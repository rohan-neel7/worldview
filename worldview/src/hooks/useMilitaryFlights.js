import { useState, useEffect, useRef, useCallback } from 'react';

// Use Vite proxy (/api/adsb -> https://api.adsb.lol)
const ADSB_URL = '/api/adsb/v2/mil';
const REFRESH_MS = 30000; // 30 seconds

export default function useMilitaryFlights(enabled, staggerMs = 1000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchMilitary = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch(ADSB_URL);
      if (!res.ok) throw new Error(`Military API HTTP ${res.status}`);
      const json = await res.json();
      const ac = (json.ac || []).filter((a) => a.lat != null && a.lon != null);

      setData(
        ac.map((a) => ({
          icao24: a.hex,
          callsign: (a.flight || '').trim(),
          type: a.t || 'UNKNOWN',
          lat: a.lat,
          lon: a.lon,
          alt: a.alt_baro || a.alt_geom || 10000,
          heading: a.track,
          speed: a.gs,
          military: true,
        }))
      );
      setError(null);
    } catch (err) {
      console.error('useMilitaryFlights error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const timeout = setTimeout(() => {
      fetchMilitary();
      intervalRef.current = setInterval(fetchMilitary, REFRESH_MS);
    }, staggerMs);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, staggerMs, fetchMilitary]);

  return { data, loading, error, refresh: fetchMilitary };
}
