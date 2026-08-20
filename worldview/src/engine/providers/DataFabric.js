/**
 * Worldview Data Fabric — Orchestration Layer
 *
 * The DataFabric sits between providers/adapters and the existing DataPipeline.
 * It is an ORCHESTRATION/ACCESS LAYER, NOT a second data store.
 *
 * Architecture:
 *   Provider → Adapter → DataFabric → existing DataPipeline → Canonical Event State
 *
 * DataFabric responsibilities:
 *   - Validates provider is registered, connected, and enabled
 *   - Enriches event provenance with provider metadata
 *   - Records health/metrics in ProviderHealthTracker
 *   - Forwards events into existing DataPipeline.ingestCanonical()
 *   - Delegates queries to DataPipeline (no duplicate event state)
 *   - Preserves all observations without merging (fusion responsibility)
 *
 * DataFabric does NOT:
 *   - Maintain its own canonical event store
 *   - Resolve event identity (that's FusionEngine)
 *   - Create timers, poll, or open WebSockets
 *   - Trigger React state updates
 *
 * Fallback semantics:
 *   When a fallback provider is used, the observation retains its actual source
 *   identity (e.g., source: 'Open-Meteo', not source: 'IMD').
 *   A fallbackUsed: true flag is added to provenance.
 */

export class DataFabric {
  /**
   * @param {object} options
   * @param {import('./ProviderRegistry.js').ProviderRegistry} options.providerRegistry
   * @param {import('./providerHealth.js').ProviderHealthTracker} options.healthTracker
   * @param {import('../pipeline/DataPipeline.js').DataPipeline} options.dataPipeline
   */
  constructor({ providerRegistry, healthTracker, dataPipeline }) {
    this.providerRegistry = providerRegistry;
    this.healthTracker = healthTracker;
    this.dataPipeline = dataPipeline;

    // Bounded pub/sub for downstream consumers
    this.subscribers = new Set();

    // Bounded observability metrics (snapshot-based, no React state)
    this.metrics = {
      eventsIngested: 0,
      eventsRejected: 0,
      providerFailures: 0,
      lastIngestAt: null,
    };
  }

  /**
   * Ingest events from a provider into the Data Fabric.
   *
   * 1. Validates providerId is registered, connected, and enabled
   * 2. Rejects ingestion from planned providers (hard isolation)
   * 3. Enriches event provenance with provider metadata
   * 4. Records success in ProviderHealthTracker
   * 5. Forwards events into existing DataPipeline.ingestCanonical()
   * 6. Notifies subscribers
   *
   * @param {string} providerId
   * @param {Array<object>} events - CanonicalEvent objects
   * @param {object} [options={}]
   * @param {boolean} [options.fallbackUsed=false] - Whether this is fallback data
   * @param {string} [options.fallbackFor=null] - Original provider ID this is a fallback for
   * @returns {{ accepted: number, rejected: number, error: string|null }}
   */
  ingest(providerId, events, options = {}) {
    // Validate provider exists
    const providerDef = this.providerRegistry.get(providerId);
    if (!providerDef) {
      this.metrics.eventsRejected += (Array.isArray(events) ? events.length : 0);
      return { accepted: 0, rejected: events?.length || 0, error: `Unknown provider: "${providerId}"` };
    }

    // Hard-isolate planned providers
    if (!providerDef.connected) {
      this.metrics.eventsRejected += (Array.isArray(events) ? events.length : 0);
      return { accepted: 0, rejected: events?.length || 0, error: `Planned provider "${providerId}" cannot ingest data` };
    }

    // Check enabled
    if (!providerDef.runtimeConfig.enabled) {
      this.metrics.eventsRejected += (Array.isArray(events) ? events.length : 0);
      return { accepted: 0, rejected: events?.length || 0, error: `Provider "${providerId}" is disabled` };
    }

    if (!Array.isArray(events) || events.length === 0) {
      return { accepted: 0, rejected: 0, error: null };
    }

    // Enrich provenance with provider metadata
    const enrichedEvents = [];
    for (const event of events) {
      if (!event || typeof event !== 'object') {
        this.metrics.eventsRejected++;
        continue;
      }

      // Enrich provenance without mutating the original event
      const enrichedProvenance = {
        ...event.provenance,
        providerId: providerDef.id,
        providerTier: providerDef.tier,
        providerVersion: providerDef.version,
        dataState: providerDef.dataState,
      };

      // Fallback provenance: retains actual source identity
      if (options.fallbackUsed) {
        enrichedProvenance.fallbackUsed = true;
        enrichedProvenance.fallbackFor = options.fallbackFor || null;
      }

      enrichedEvents.push({
        ...event,
        provenance: enrichedProvenance,
      });
    }

    // Forward to existing DataPipeline (single source of truth for event storage)
    try {
      this.dataPipeline.ingestCanonical(enrichedEvents);

      // Record success in health tracker
      this.healthTracker.recordSuccess(providerId);

      // Record data received time from the most recent event
      const latestObservedAt = enrichedEvents.reduce((latest, ev) => {
        if (!ev.observedAt) return latest;
        return !latest || ev.observedAt > latest ? ev.observedAt : latest;
      }, null);
      if (latestObservedAt) {
        this.healthTracker.recordDataReceived(providerId, latestObservedAt);
      }

      // Update metrics
      this.metrics.eventsIngested += enrichedEvents.length;
      this.metrics.lastIngestAt = new Date().toISOString();

      // Notify subscribers
      this._notifySubscribers({
        type: 'INGEST',
        providerId,
        count: enrichedEvents.length,
        timestamp: this.metrics.lastIngestAt,
      });

      return { accepted: enrichedEvents.length, rejected: events.length - enrichedEvents.length, error: null };
    } catch (err) {
      this.metrics.providerFailures++;
      this.healthTracker.recordFailure(providerId, 'TEMPORARY', err.message);
      return { accepted: 0, rejected: events.length, error: err.message };
    }
  }

  /**
   * Query events — delegates to existing DataPipeline.
   * No duplicate event state.
   *
   * @param {object} [filter={}]
   * @returns {Array<object>}
   */
  query(filter = {}) {
    return this.dataPipeline.getEvents(filter);
  }

  /**
   * Get most recent events from a specific provider.
   * Delegates to pipeline, filters by provenance.source.
   *
   * @param {string} providerId
   * @returns {Array<object>}
   */
  getLatest(providerId) {
    const def = this.providerRegistry.get(providerId);
    if (!def) return [];
    // Filter by the adapter's source name (which is what CanonicalEvents use)
    const allEvents = this.dataPipeline.getEvents({});
    return allEvents.filter((ev) =>
      ev.provenance?.providerId === providerId || ev.source === def.adapterKey
    );
  }

  /**
   * Get events within a radius of a location.
   * Delegates to pipeline + spatial filter.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} [radiusKm=100]
   * @returns {Array<object>}
   */
  getByLocation(lat, lon, radiusKm = 100) {
    const allEvents = this.dataPipeline.getEvents({});
    return allEvents.filter((ev) => {
      if (!ev.location || typeof ev.location.lat !== 'number' || typeof ev.location.lon !== 'number') return false;
      const R = 6371;
      const dLat = ((ev.location.lat - lat) * Math.PI) / 180;
      const dLon = ((ev.location.lon - lon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((ev.location.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c <= radiusKm;
    });
  }

  /**
   * Get events by type — delegates to pipeline.
   *
   * @param {string} eventType
   * @returns {Array<object>}
   */
  getByType(eventType) {
    return this.dataPipeline.getEvents({ type: eventType });
  }

  /**
   * Get events by provider — delegates to pipeline + filter.
   *
   * @param {string} providerId
   * @returns {Array<object>}
   */
  getByProvider(providerId) {
    return this.getLatest(providerId);
  }

  /**
   * Get aggregated health across all connected providers.
   *
   * @returns {object}
   */
  getHealth() {
    const connected = this.providerRegistry.getConnected();
    const healthSummary = {
      totalProviders: connected.length,
      healthy: 0,
      degraded: 0,
      failed: 0,
      unknown: 0,
      providers: {},
    };

    for (const def of connected) {
      const health = this.healthTracker.getHealth(def.id);
      healthSummary.providers[def.id] = health;

      switch (health.status) {
        case 'HEALTHY': healthSummary.healthy++; break;
        case 'DEGRADED': healthSummary.degraded++; break;
        case 'FAILED': healthSummary.failed++; break;
        default: healthSummary.unknown++; break;
      }
    }

    return healthSummary;
  }

  /**
   * Get aggregated freshness across all connected providers.
   *
   * @returns {object}
   */
  getFreshness() {
    const connected = this.providerRegistry.getConnected();
    const freshnessSummary = {
      providers: {},
    };

    for (const def of connected) {
      freshnessSummary.providers[def.id] = {
        freshness: this.healthTracker.getDataFreshness(
          def.id,
          def.temporalResolution.expectedFreshnessMs
        ),
        lastDataTime: this.healthTracker.getHealth(def.id).lastDataTime,
      };
    }

    return freshnessSummary;
  }

  /**
   * Subscribe to fabric events (bounded).
   *
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * @private
   */
  _notifySubscribers(event) {
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (_e) {
        // Subscriber errors must not break the fabric
      }
    }
  }

  /**
   * Get observability metrics snapshot.
   * Does NOT trigger React state updates.
   *
   * @returns {object}
   */
  getMetrics() {
    return { ...this.metrics };
  }
}
