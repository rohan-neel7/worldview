import { useState, useCallback } from 'react';
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

      if (res.ok && data.intelligence) {
        const trimmed = data.intelligence.trim();
        setIntelligence(trimmed);
        setGeminiOutput(trimmed);
        setPriority(
          trimmed.includes('HIGH') ? 'HIGH' :
          trimmed.includes('MED') ? 'MED' : 'LOW'
        );
      } else {
        throw new Error(data.message || data.error || 'No intelligence output');
      }
    } catch (e) {
      console.error('Gemini error:', e);
      const fallback = `[PRIORITY: LOW] ${e.message || 'Intelligence feed offline. Manual analysis required.'}`;
      setIntelligence(fallback);
      setGeminiOutput(fallback);
      setPriority('LOW');
    } finally {
      setLoading(false);
    }
  }, [flightCount, quakeCount, satCount, topQuake, selectedRegion, setGeminiOutput]);

  return { intelligence, priority, loading, runAnalysis };
}
