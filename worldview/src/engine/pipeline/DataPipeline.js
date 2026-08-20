import { defaultAdapterRegistry } from '../adapters/index.js';
import { defaultFusionEngine } from '../fusion/index.js';
import { IncidentManager } from '../incident/IncidentManager.js';
import { RiskEngine } from '../risk/RiskEngine.js';
import { ScenarioRunner } from '../simulation/ScenarioRunner.js';
import { SourceMode } from '../event/types.js';
import { IntelligenceEngine } from '../intelligence/index.js';

export class DataPipeline {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.adapterRegistry = options.adapterRegistry || defaultAdapterRegistry;
    this.fusionEngine = options.fusionEngine || defaultFusionEngine;
    this.incidentManager = options.incidentManager || new IncidentManager();
    this.intelligenceEngine = options.intelligenceEngine || new IntelligenceEngine();
    this.riskEngine = RiskEngine;
    this.scenarioRunner = new ScenarioRunner(this);

    // In-memory bounded canonical event store (Map<id, CanonicalEvent>)
    this.eventsStore = new Map();
    this.maxEvents = options.maxEvents || 1500;

    // Metrics tracking
    this.metrics = {
      totalIngested: 0,
      liveCount: 0,
      simulatedCount: 0,
      lastProcessedAt: null,
    };
  }

  /**
   * Primary ingestion entry point: ingests raw provider payload through adapter.
   *
   * @param {string} adapterKey - 'USGS' | 'OpenSky' | 'CelesTrak' | 'AISStream' | 'OpenMeteo' | 'adsb.lol' | 'SIMULATION' | etc.
   * @param {any} rawData - Upstream raw payload
   * @param {object} [context={}]
   * @returns {{ normalizedCount: number, activeIncidentsCount: number, error: string|null }}
   */
  ingestRaw(adapterKey, rawData, context = {}) {
    const { events, error } = this.adapterRegistry.normalize(adapterKey, rawData, context);

    if (error) {
      console.warn(`[DataPipeline] Ingestion warning from ${adapterKey}:`, error);
    }

    if (events.length > 0) {
      this.ingestCanonical(events);
    }

    return {
      normalizedCount: events.length,
      activeIncidentsCount: this.incidentManager.getActive().length,
      error,
    };
  }

  /**
   * Ingests already-normalized CanonicalEvent objects into working memory and runs downstream intelligence.
   *
   * @param {Array<object>} events - CanonicalEvent objects
   */
  ingestCanonical(events) {
    if (!Array.isArray(events) || events.length === 0) return;

    for (const ev of events) {
      if (!ev || !ev.id) continue;
      this.eventsStore.set(ev.id, ev);
      this.metrics.totalIngested++;
    }

    // Enforce store capacity
    if (this.eventsStore.size > this.maxEvents) {
      const keysToDelete = Array.from(this.eventsStore.keys()).slice(
        0,
        this.eventsStore.size - this.maxEvents
      );
      for (const k of keysToDelete) {
        this.eventsStore.delete(k);
      }
    }

    this.metrics.lastProcessedAt = new Date().toISOString();
    this.recomputeMetrics();

    // Downstream Pipeline: Intelligence Engine (Correlation -> Hypotheses -> Incident Promotion)
    this.evaluatePipeline();
  }

  /**
   * Executes the downstream intelligence pipeline:
   * Working Memory -> Intelligence Engine (Correlation -> RealWorldEvent -> Hypotheses) -> Incident Manager
   */
  evaluatePipeline() {
    const allEvents = Array.from(this.eventsStore.values());
    if (allEvents.length === 0) return;

    // Run full deterministic Intelligence Engine evaluation
    const { hypotheses } = this.intelligenceEngine.evaluate(allEvents);

    // Promote hypotheses to canonical IncidentManager
    this.intelligenceEngine.promoteHypotheses(hypotheses, { incidentManager: this.incidentManager });
  }

  recomputeMetrics() {
    let live = 0;
    let sim = 0;

    for (const ev of this.eventsStore.values()) {
      if (ev.sourceMode === SourceMode.SIMULATED) {
        sim++;
      } else {
        live++;
      }
    }

    this.metrics.liveCount = live;
    this.metrics.simulatedCount = sim;
  }

  getEvents(filter = {}) {
    let list = Array.from(this.eventsStore.values());

    if (filter.category) {
      list = list.filter((e) => e.category === filter.category);
    }
    if (filter.type) {
      list = list.filter((e) => e.type === filter.type);
    }
    if (filter.sourceMode) {
      list = list.filter((e) => e.sourceMode === filter.sourceMode);
    }
    if (filter.status) {
      list = list.filter((e) => e.freshness?.status === filter.status);
    }

    return list;
  }

  getIncidents() {
    return this.incidentManager.getAll();
  }

  getActiveIncidents() {
    return this.incidentManager.getActive();
  }

  getPipelineMetrics() {
    const intelMetrics = this.intelligenceEngine.getMetrics();
    return {
      ...this.metrics,
      ...intelMetrics,
      activeEventsInStore: this.eventsStore.size,
      totalIncidents: this.incidentManager.getAll().length,
      activeIncidents: this.incidentManager.getActive().length,
    };
  }

  clear() {
    this.eventsStore.clear();
    this.incidentManager.clear();
    this.intelligenceEngine.clear();
    this.metrics = {
      totalIngested: 0,
      liveCount: 0,
      simulatedCount: 0,
      lastProcessedAt: null,
    };
  }
}

export const globalDataPipeline = new DataPipeline();
