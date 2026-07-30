import { useState, useEffect, useRef, useCallback } from 'react';

// Use backend proxy to fetch satellite TLE data
const TLE_URL = '/api/satellites';
const REFRESH_MS = 30000; // 30 seconds
const CAP = 200; // Rule 7

export default function useSatellites(enabled, staggerMs = 3000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const workerRef = useRef(null);
  const tleLoaded = useRef(false);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/satelliteWorker.js', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'POSITIONS_COMPUTED') {
        const positions = e.data.positions;
        console.log(`[useSatellites] Propagated ${positions.length} positions. First 3:`, positions.slice(0, 3));
        setData(positions);
        setError(null);
      } else if (e.data.type === 'TLE_UPDATED') {
        console.log(`[useSatellites] Parsed ${e.data.count} satellite records from TLE data`);
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Fetch TLE data once, then propagate on every interval
  const fetchTLE = useCallback(async () => {
    try {
      // Create an abort controller to aggressively timeout CelesTrak if it hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second max
      
      let res;
      try {
        res = await fetch(TLE_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
      } catch (err) {
        // Fallback to our local static copy of active satellites
        console.warn('[useSatellites] CelesTrak failed or timed out. Falling back to local data.', err);
        clearTimeout(timeoutId);
        res = await fetch('/data/active-satellites.txt');
        if (!res.ok) throw new Error('Local fallback also failed.');
      }

      // ── Debug 1: log raw response status & first 500 chars ──
      const text = await res.text();
      console.log('[useSatellites] TLE response status:', res.status);
      console.log('[useSatellites] TLE raw (first 500 chars):', text.slice(0, 500));

      workerRef.current?.postMessage({
        type: 'UPDATE_TLE',
        payload: { text, cap: CAP }
      });
      tleLoaded.current = true;
    } catch (err) {
      console.error('[useSatellites] TLE fetch error:', err);
      throw err;
    }
  }, []);

  const propagate = useCallback(() => {
    if (tleLoaded.current) {
      workerRef.current?.postMessage({
        type: 'PROPAGATE',
        payload: { time: new Date().getTime() }
      });
    }
  }, []);

  const fetch_and_propagate = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      if (!tleLoaded.current) {
        await fetchTLE();
      }
      propagate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchTLE, propagate]);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const timeout = setTimeout(() => {
      fetch_and_propagate();
      intervalRef.current = setInterval(() => {
        propagate(); // Just re-propagate, don't re-fetch TLE
      }, REFRESH_MS);
    }, staggerMs);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, staggerMs, fetch_and_propagate, propagate]);

  return { data, loading, error, refresh: fetch_and_propagate };
}
