/**
 * Worldview Disaster Intelligence — Unified Intelligence Orchestrator
 *
 * Coordinates:
 *   Data Fabric Events → Event Correlation → Anomaly Detection → Hazard Reasoning
 *   → Exposure Assessment → Secondary Cascades → Crisis Priority → Incident Promotion
 *
 * Adheres to Phase 6C Mandates & Corrections #1–15:
 *   - 100% deterministic reasoning (Zero Gemini dependency for truth/risk).
 *   - No duplicate event or incident stores; promoted crises flow into IncidentManager.
 *   - Bounded recalculation with country-level geofencing (no wasteful global loops).
 */

// ── Models & Subsystems ──────────────────────────────────────────────────────
export { HazardHypothesis } from './HazardHypothesis.js';
export { EventCorrelator } from './correlation/EventCorrelator.js';
export { CORRELATION_RULES } from './correlation/correlationRules.js';
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

    // Bounded telemetry metrics (Section 31)
    this.metrics = {
      eventsConsidered: 0,
      eventsFiltered: 0,
      clustersFormed: 0,
      anomaliesDetected: 0,
      hypothesesCreated: 0,
      incidentsPromoted: 0,
      conflictsDetected: 0,
      lastProcessingLatencyMs: 0,
    };
  }

  /**
   * Processes normalized canonical events through the full intelligence pipeline.
   *
   * @param {Array<object>} events - Normalized CanonicalEvents
   * @param {object} [context={}] - Optional theater/country bounds context
   * @returns {{ hypotheses: Array<HazardHypothesis>, anomalies: Array<object>, clusters: Array<object>, metrics: object }}
   */
  evaluate(events = [], context = {}) {
    const startTime = Date.now();

    if (!Array.isArray(events) || events.length === 0) {
      return {
        hypotheses: [],
        anomalies: [],
        clusters: [],
        metrics: { ...this.metrics, lastProcessingLatencyMs: 0 },
      };
    }

    // 1. Geofence / Country Filtering (Correction #25: No wasteful global recalculation)
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

    // 2. Anomaly Detection Layer
    const anomalies = this.anomalyEngine.detect(candidateEvents, context);

    // 3. Spatial, Temporal, and Semantic Correlation Layer
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

    // Update bounded metrics
    this.metrics = {
      eventsConsidered: candidateEvents.length,
      eventsFiltered: filteredCount,
      clustersFormed: clusters.length,
      anomaliesDetected: anomalies.length,
      hypothesesCreated: hypotheses.length,
      incidentsPromoted: hypotheses.filter((h) => h.shouldPromote).length,
      conflictsDetected: conflictsCount,
      lastProcessingLatencyMs: latency,
    };

    return {
      hypotheses,
      anomalies,
      clusters,
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
}

export const globalIntelligenceEngine = new IntelligenceEngine();
