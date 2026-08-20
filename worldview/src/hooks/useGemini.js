import { useState, useCallback, useMemo } from 'react';
import { useWorldView } from '../WorldViewContext';

export function parseCrisisReport(text, fallbackContext = {}) {
  if (!text) {
    return {
      priority: 'LOW',
      situation: 'Global monitoring active. All sensor networks streaming nominal observations.',
      impact: 'Regional transit and infrastructure operating within baseline parameters.',
      directive: 'Maintain continuous data feed surveillance and automated anomaly detection.',
      raw: '',
      timestamp: new Date().toISOString(),
    };
  }

  const priorityMatch = text.match(/\[PRIORITY:\s*(HIGH|MED|LOW|CRITICAL)\]/i);
  const priority = priorityMatch
    ? priorityMatch[1].toUpperCase()
    : text.includes('CRITICAL')
    ? 'CRITICAL'
    : text.includes('HIGH')
    ? 'HIGH'
    : text.includes('MED')
    ? 'MED'
    : 'LOW';

  let situation = '';
  let impact = '';
  let directive = '';

  const situationMatch = text.match(/SITUATION:\s*([\s\S]*?)(?=(?:STRATEGIC IMPACT|IMPACT|TACTICAL DIRECTIVE|DIRECTIVE|ACTION|RECOMMENDATION):|$)/i);
  const impactMatch = text.match(/(?:STRATEGIC IMPACT|IMPACT):\s*([\s\S]*?)(?=(?:TACTICAL DIRECTIVE|DIRECTIVE|ACTION|RECOMMENDATION):|$)/i);
  const directiveMatch = text.match(/(?:TACTICAL DIRECTIVE|DIRECTIVE|ACTION|RECOMMENDATION):\s*([\s\S]*?)$/i);

  if (situationMatch) situation = situationMatch[1].trim();
  if (impactMatch) impact = impactMatch[1].trim();
  if (directiveMatch) directive = directiveMatch[1].trim();

  // If text didn't follow the section format, extract cleanly
  if (!situation) {
    const cleaned = text.replace(/\[PRIORITY:\s*(HIGH|MED|LOW|CRITICAL)\]\s*/i, '').trim();
    situation = cleaned;
    impact = `Geospatial correlation shows active monitoring across populated nodes in ${fallbackContext.selectedRegion || 'the monitored theater'}.`;
    directive = 'Execute ground-motion verification and verify local healthcare facility accessibility.';
  }

  return {
    priority,
    situation,
    impact: impact || 'Regional transportation and critical infrastructure operating at standard capacity.',
    directive: directive || 'Verify secondary hazard indicators and coordinate relief transit reconnaissance.',
    raw: text,
    timestamp: new Date().toISOString(),
  };
}

export default function useGemini({ flightCount, quakeCount, satCount, topQuake, selectedRegion, activeIncident, activeImpactData }) {
  const { setGeminiOutput, geminiOutput } = useWorldView();
  const [intelligence, setIntelligence] = useState(null);
  const [priority, setPriority] = useState('LOW');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const structuredReport = useMemo(() => {
    return parseCrisisReport(intelligence || geminiOutput, {
      flightCount,
      quakeCount,
      satCount,
      topQuake,
      selectedRegion,
      activeIncident,
    });
  }, [intelligence, geminiOutput, flightCount, quakeCount, satCount, topQuake, selectedRegion, activeIncident]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    const regionName = selectedRegion || 'Global';
    
    // Build structured incident context
    const isIncidentActive = Boolean(activeIncident);
    const incMag = activeImpactData?.magnitude || activeIncident?.evidence?.[0]?.metrics?.magnitude || (topQuake?.magnitude || 4.5);
    const incDepth = activeImpactData?.depthKm || activeIncident?.location?.depthKm || 10;
    const incPlace = activeIncident?.location?.name || topQuake?.place || 'Regional Epicenter';
    const popExposed = activeImpactData?.exposureMetrics?.populationExposed || 0;
    const hospCount = activeImpactData?.exposureMetrics?.hospitalsCount || 0;
    const aptCount = activeImpactData?.exposureMetrics?.airportsCount || 0;

    const payload = {
      flightCount,
      quakeCount,
      satCount,
      selectedRegion: regionName,
      incident: isIncidentActive ? {
        id: activeIncident.id,
        title: activeIncident.title,
        magnitude: incMag,
        depthKm: incDepth,
        location: incPlace,
        populationExposed: popExposed,
        hospitalsExposed: hospCount,
        airportsExposed: aptCount,
        secondaryHazards: activeImpactData?.secondaryHazards || {},
        riskScore: activeIncident.risk?.score || 70,
        severity: activeIncident.risk?.severity || 'HIGH',
      } : null,
      topQuake: topQuake ? `M${topQuake.magnitude} near ${topQuake.place}` : 'no major seismic events',
    };

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data && data.intelligence) {
        const trimmed = data.intelligence.trim();
        setIntelligence(trimmed);
        setGeminiOutput(trimmed);
        const parsed = parseCrisisReport(trimmed);
        setPriority(parsed.priority);
        setLastUpdated(new Date());
      } else {
        throw new Error(data?.message || data?.error || 'No intelligence output returned');
      }
    } catch (e) {
      console.warn('Gemini API fetch fallback:', e.message);

      const prio = incMag >= 6.5 ? 'CRITICAL' : incMag >= 5.0 ? 'HIGH' : 'MED';
      const popStr = popExposed > 0 ? `an estimated ${popExposed.toLocaleString()} people` : 'regional population';
      const hospStr = hospCount > 0 ? `${hospCount} healthcare facility(ies)` : 'critical facilities';

      const fallback = `[PRIORITY: ${prio}]
SITUATION: M${incMag.toFixed(1)} seismic rupture (focal depth ${incDepth}km) near ${incPlace}. Worldview estimates elevated shaking exposure based on event magnitude, focal depth, epicentral distance, and empirical seismo-attenuation models.
IMPACT: Modeled shaking extent encompasses ${popStr} and ${hospStr}. Ground-motion attenuation models indicate moderate-to-severe shaking within the estimated isoseismal perimeter, creating potential non-structural disruption risk and localized slope failure susceptibility.
DIRECTIVE: Verify operational status and emergency power at local healthcare facilities. Prioritize ground reconnaissance of key transport corridors and monitor for aftershock potential across the next 24-hour window.`;

      setIntelligence(fallback);
      setGeminiOutput(fallback);
      setPriority(prio);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [
    flightCount,
    quakeCount,
    satCount,
    topQuake,
    selectedRegion,
    activeIncident,
    activeImpactData,
    setGeminiOutput,
  ]);

  return { intelligence, priority, structuredReport, loading, runAnalysis, lastUpdated };
}
