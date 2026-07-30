import { useState, useEffect, useCallback } from 'react';
import { useWorldView } from '../WorldViewContext';

export default function useGemini({ flightCount, quakeCount, satCount, topQuake, selectedRegion }) {
  const { setGeminiOutput } = useWorldView();
  const [intelligence, setIntelligence] = useState(null);
  const [priority, setPriority] = useState('LOW');
  const [loading, setLoading] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    const regionName = selectedRegion || 'Global';
    const quakeInfo = topQuake
      ? `M${topQuake.magnitude} near ${topQuake.place}`
      : 'no significant events';

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightCount,
          quakeCount,
          satCount,
          topQuake: quakeInfo,
          selectedRegion: regionName,
        }),
      });

      const data = await res.json();
      const text = data.intelligence;

      if (text) {
        const trimmed = text.trim();
        setIntelligence(trimmed);
        setGeminiOutput(trimmed);
        setPriority(
          trimmed.includes('HIGH') ? 'HIGH' :
          trimmed.includes('MED') ? 'MED' : 'LOW'
        );
      } else {
        throw new Error(data.message || 'No intelligence output');
      }
    } catch (e) {
      console.error('Gemini error:', e);
      const fallback = '[PRIORITY: LOW] Intelligence feed offline. Manual analysis required.';
      setIntelligence(fallback);
      setGeminiOutput(fallback);
      setPriority('LOW');
    } finally {
      setLoading(false);
    }
  }, [flightCount, quakeCount, satCount, topQuake, selectedRegion, setGeminiOutput]);

  // Auto-trigger on mount after staggering 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      runAnalysis();
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-repeat every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      runAnalysis();
    }, 60000);
    return () => clearInterval(interval);
  }, [flightCount, quakeCount]);

  return { intelligence, priority, loading, runAnalysis };
}
