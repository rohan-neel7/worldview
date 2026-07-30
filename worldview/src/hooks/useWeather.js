import { useState, useEffect, useRef, useCallback } from 'react';

// NOAA NEXRAD radar tile URL — used as ImageryProvider in Cesium, not direct fetch
const NEXRAD_WMS = 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows';
const REFRESH_MS = 300000; // 5 minutes

export default function useWeather(enabled, staggerMs = 12000) {
  const [tileUrl, setTileUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    try {
      // Append cache-buster to force tile refresh
      setTileUrl(`${NEXRAD_WMS}?cacheBust=${Date.now()}`);
      setError(null);
    } catch (err) {
      console.error('useWeather error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setTileUrl(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const timeout = setTimeout(() => {
      refresh();
      intervalRef.current = setInterval(refresh, REFRESH_MS);
    }, staggerMs);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, staggerMs, refresh]);

  return { tileUrl, loading, error, refresh };
}
