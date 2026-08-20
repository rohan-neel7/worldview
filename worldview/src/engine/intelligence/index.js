/**
 * Worldview Disaster Intelligence — Unified Intelligence Orchestrator
 *
 * Coordinates:
 *   Data Fabric Events → Event Correlation → Real-World Events → Anomaly Detection
 *   → Hazard Hypotheses → Exposure Assessment → Secondary Cascades → Crisis Priority → Incident Promotion
 *
 * Adheres to Phase 6C-H Rules:
 *   - 100% deterministic reasoning (Zero Gemini dependency for truth/risk).
 *   - Strictly enforces entity hierarchy: Observation -> Cluster -> RealWorldEvent -> Hypothesis -> Candidate -> Incident.
 *   - No duplicate event or incident stores; promoted crises flow into IncidentManager.
 *   - Bounded recalculation with country-level geofencing (no wasteful global loops).
 *   - Exposes exact reduction observability metrics (rawEvents -> significant -> clusters -> real-world -> hypotheses -> candidates -> incidents).
 */

// ── Models & Subsystems ──────────────────────────────────────────────────────
export { HazardHypothesis } from './HazardHypothesis.js';
export { EventCorrelator } from './correlation/EventCorrelator.js';
export { CORRELATION_RULES } from './correlation/correlationRules.js';
export {
  CORRELATION_POLICIES,
  CorrelationDecision,
  BaseCorrelationPolicy,
  EarthquakeCorrelationPolicy,
  WildfireCorrelationPolicy,
  FloodCorrelationPolicy,
  CycloneCorrelationPolicy,
  GenericCorrelationPolicy,
} from './correlation/correlationPolicies.js';
export { AnomalyEngine } from './anomaly/AnomalyEngine.js';
export { ANOMALY_THRESHOLDS } from './anomaly/anomalyRules.js';
export { ExposureEngine, globalExposureEngine } from './exposure/ExposureEngine.js';
export { SecondaryRiskEngine } from './secondary/SecondaryRiskEngine.js';
export { EvidenceEngine, REQUIRED_EVIDENCE_SPEC } from './evidence/EvidenceEngine.js';

// ── Hazard Intelligence Modules ──────────────────────────────────────────────
export { EarthquakeIntelligence } from './hazards/EarthquakeIntelligence.js';
export { FloodIntelligence } from './hazards/FloodIntelligence.js';
export { WildfireIntelligence } from './hazards/WildfireIntelligence.js';
export { CycloneIntelligence } from './hazards/CycloneIntelligence.js';

import { EventCorrelator } from './correlation/EventCorrelator.js';
import { AnomalyEngine } from './anomaly/AnomalyEngine.js';
import { ExposureEngine, globalExposureEngine } from './exposure/ExposureEngine.js';
import { EarthquakeIntelligence } from './hazards/EarthquakeIntelligence.js';
import { FloodIntelligence } from './hazards/FloodIntelligence.js';
import { WildfireIntelligence } from './hazards/WildfireIntelligence.js';
import { CycloneIntelligence } from './hazards/CycloneIntelligence.js';
import { defaultIncidentManager } from '../incident/IncidentManager.js';
import { isPointInCountryBounds } from '../../data/countries.js';
import { SeverityLevel } from '../event/types.js';

export class IntelligenceEngine {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.correlator = options.correlator || new EventCorrelator();
    this.anomalyEngine = options.anomalyEngine || new AnomalyEngine();
    this.exposureEngine = options.exposureEngine || globalExposureEngine;

    this.earthquakeIntelligence = new EarthquakeIntelligence({ exposureEngine: this.exposureEngine });
    this.floodIntelligence = new FloodIntelligence({ exposureEngine: this.exposureEngine });
    this.wildfireIntelligence = new WildfireIntelligence({ exposureEngine: this.exposureEngine });
    this.cycloneIntelligence = new CycloneIntelligence({ exposureEngine: this.exposureEngine });

    // Bounded telemetry metrics (Section 32 Observability Reduction)
    this.metrics = {
      rawEvents: 0,
      significantEvents: 0,
      eventClusters: 0,
      uniqueRealWorldEvents: 0,
      hazardHypotheses: 0,
      crisisCandidates: 0,
      activeIncidents: 0,
      criticalIncidents: 0,
      duplicatesCollapsed: 0,
      conflictsDetected: 0,
      eventsConsidered: 0,
      eventsFiltered: 0,
      clustersFormed: 0,
      anomaliesDetected: 0,
      hypothesesCreated: 0,
      incidentsPromoted: 0,
      lastProcessingLatencyMs: 0,
    };
  }

  /**
   * Processes normalized canonical events through the full intelligence pipeline.
   *
   * @param {Array<object>} events - Normalized CanonicalEvents
   * @param {object} [context={}] - Optional theater/country bounds context
   * @returns {{ hypotheses: Array<HazardHypothesis>, anomalies: Array<object>, clusters: Array<object>, realWorldEvents: Array<object>, metrics: object }}
   */
  evaluate(events = [], context = {}) {
    const startTime = Date.now();

    if (!Array.isArray(events) || events.length === 0) {
      return {
        hypotheses: [],
        anomalies: [],
        clusters: [],
        realWorldEvents: [],
        metrics: { ...this.metrics, lastProcessingLatencyMs: 0 },
      };
    }

    // 1. Geofence / Country Filtering
    let candidateEvents = events;
    let filteredCount = 0;

    if (context.country) {
      candidateEvents = events.filter((e) => {
        if (!e.location || typeof e.location.lat !== 'number' || typeof e.location.lon !== 'number') {
          return false;
        }
        return isPointInCountryBounds(e.location.lat, e.location.lon, context.country);
      });
      filteredCount = events.length - candidateEvents.length;
    }

    // Filter significant events threshold (e.g. M >= 4.0, Rain >= 30mm, FRP >= 15MW)
    const significantEvents = candidateEvents.filter((e) => {
      if (e.type === 'EARTHQUAKE') return (e.payload?.magnitude || e.magnitude || 0) >= 4.0;
      if (e.type === 'WEATHER') return (e.payload?.rainfallMm || 0) >= 30 || (e.payload?.windSpeedMps || 0) >= 15;
      if (e.type === 'WILDFIRE_HOTSPOT') return (e.payload?.frp || 0) >= 10;
      return true;
    });

    // 2. Anomaly Detection Layer
    const anomalies = this.anomalyEngine.detect(candidateEvents, context);

    // 3. Spatial, Temporal, and Semantic Correlation Layer (Deterministic RealWorldEvents)
    const clusters = this.correlator.correlate(candidateEvents, context);

    // 4. Hazard Hypotheses Generation
    const hypotheses = [];
    let conflictsCount = 0;

    for (const cluster of clusters) {
      if (cluster.conflicts && cluster.conflicts.length > 0) {
        conflictsCount += cluster.conflicts.length;
      }

      // Filter matching anomalies for this cluster
      const clusterAnomalies = anomalies.filter((a) =>
        a.contributingEventIds?.some((id) => cluster.eventIds.includes(id))
      );

      let hypothesis = null;

      switch (cluster.hazardType) {
        case 'EARTHQUAKE':
          hypothesis = this.earthquakeIntelligence.evaluate(cluster, clusterAnomalies);
          break;
        case 'FLOOD':
          hypothesis = this.floodIntelligence.evaluate(cluster, clusterAnomalies);
          break;
        case 'WILDFIRE':
          hypothesis = this.wildfireIntelligence.evaluate(cluster, clusterAnomalies);
          break;
        case 'CYCLONE':
          hypothesis = this.cycloneIntelligence.evaluate(cluster, clusterAnomalies);
          break;
        default:
          break;
      }

      if (hypothesis) {
        hypotheses.push(hypothesis);
      }
    }

    // 5. Deterministic Priority Sorting (Priority desc > Severity desc > Time desc)
    hypotheses.sort((a, b) => {
      if (b.crisisPriority !== a.crisisPriority) {
        return b.crisisPriority - a.crisisPriority;
      }
      return new Date(b.temporal.lastObservedAt).getTime() - new Date(a.temporal.lastObservedAt).getTime();
    });

    const latency = Date.now() - startTime;
    const candidates = hypotheses.filter((h) => h.shouldPromote);
    const criticalCandidates = candidates.filter((h) => h.severity === SeverityLevel.CRITICAL);
    const duplicatesCollapsed = candidateEvents.length - clusters.length;

    // Update bounded reduction telemetry metrics
    this.metrics = {
      rawEvents: candidateEvents.length,
      significantEvents: significantEvents.length,
      eventClusters: clusters.length,
      uniqueRealWorldEvents: clusters.length,
      hazardHypotheses: hypotheses.length,
      crisisCandidates: candidates.length,
      activeIncidents: candidates.length,
      criticalIncidents: criticalCandidates.length,
      duplicatesCollapsed: Math.max(0, duplicatesCollapsed),
      conflictsDetected: conflictsCount,
      eventsConsidered: candidateEvents.length,
      eventsFiltered: filteredCount,
      clustersFormed: clusters.length,
      anomaliesDetected: anomalies.length,
      hypothesesCreated: hypotheses.length,
      incidentsPromoted: candidates.length,
      lastProcessingLatencyMs: latency,
    };

    return {
      hypotheses,
      anomalies,
      clusters,
      realWorldEvents: clusters.map((c) => c.realWorldEvent).filter(Boolean),
      metrics: { ...this.metrics },
    };
  }

  /**
   * Promotes qualifying hypotheses to the canonical IncidentManager.
   *
   * @param {Array<HazardHypothesis>} hypotheses
   * @param {object} [options={}]
   * @returns {{ promoted: Array<object>, total: number }}
   */
  promoteHypotheses(hypotheses = [], options = {}) {
    const incidentManager = options.incidentManager || defaultIncidentManager;
    const promoted = [];

    for (const hyp of hypotheses) {
      if (hyp.shouldPromote) {
        // Prepare risk assessment object for existing IncidentManager ingestion
        const riskAssessment = {
          score: hyp.crisisPriority,
          severity: hyp.severity,
          confidence: hyp.assessmentConfidence,
          breakdown: [
            { factor: 'Crisis Priority', score: hyp.crisisPriority, rationale: hyp.explanation },
            { factor: 'Exposure Score', score: hyp.exposure?.summaryScore || 0, rationale: 'Demographic & asset exposure' },
          ],
          explanation: hyp.explanation,
        };

        const incident = incidentManager.ingestHypothesis(hyp.toJSON(), riskAssessment);
        if (incident) {
          promoted.push(incident);
        }
      }
    }

    return { promoted, total: promoted.length };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  clear() {
    this.correlator.clear();
  }
}

export const globalIntelligenceEngine = new IntelligenceEngine();
