import { useState, useEffect, useCallback, useRef } from 'react';

export default function useShips(enabled, regionKey) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);

  const fetchShips = useCallback(async () => {
    if (!enabled) return;

    try {
      const region = regionKey || 'GLOBAL';
      const res = await fetch(`/api/ships?region=${encodeURIComponent(region)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();
      if (Array.isArray(result.ships)) {
        setData(result.ships);
        setError(null);
      } else {
        throw new Error('Invalid ships payload format');
      }
    } catch (err) {
      console.error('[useShips] Fetch error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled, regionKey]);

  useEffect(() => {
    if (enabled) {
      setLoading(true);
      fetchShips();
      pollTimerRef.current = setInterval(fetchShips, 3000);
    } else {
      setData([]);
      setLoading(false);
      setError(null);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [enabled, fetchShips]);

  return { data, loading, error };
}
