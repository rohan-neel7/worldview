import { BaseAdapter } from './BaseAdapter.js';
import { createCanonicalEvent } from '../event/CanonicalEvent.js';
import { EventCategory, SourceMode, EventType } from '../event/types.js';

export class SimulationAdapter extends BaseAdapter {
  constructor() {
    super('SIMULATION_ENGINE', 'sim://deterministic-scenario');
  }

  /**
   * @param {Array|object} rawData - Scenario event definitions
   * @param {object} [context={}]
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    const receivedAt = context.receivedAt || new Date().toISOString();
    const processedAt = new Date().toISOString();

    let items = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && typeof rawData === 'object') {
      items = [rawData];
    }

    const events = [];

    for (const item of items) {
      if (!item) continue;

      const id = item.id || `sim-${Math.random().toString(36).substring(2, 9)}`;
      const source = item.source || 'SIMULATION_ENGINE';
      const type = item.type || EventType.GENERIC_OBSERVATION;
      const category = item.category || EventCategory.OBSERVATION;
      const observedAt = item.observedAt ? new Date(item.observedAt).toISOString() : new Date().toISOString();
      const lat = item.location?.lat !== undefined ? item.location.lat : item.lat;
      const lon = item.location?.lon !== undefined ? item.location.lon : item.lon;
      const confidence = typeof item.confidence === 'number' ? item.confidence : 0.95;

      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        continue;
      }

      // CRITICAL RULE: SourceMode for simulation adapter MUST ALWAYS be SIMULATED
      const event = createCanonicalEvent({
        id: id.startsWith('sim:') ? id : `sim:${id}`,
        source,
        sourceMode: SourceMode.SIMULATED,
        type,
        category,
        observedAt,
        receivedAt,
        processedAt,
        location: {
          lat: Number(lat.toFixed(5)),
          lon: Number(lon.toFixed(5)),
          altMeters: item.location?.altMeters || 0,
          depthKm: item.location?.depthKm,
        },
        geometry: item.geometry,
        confidence,
        maxAgeMs: item.maxAgeMs || 3600000,
        provenance: {
          providerEventId: id,
          providerEndpoint: item.scenarioId ? `sim://scenario/${item.scenarioId}` : this.endpoint,
          version: this.version,
          originalRef: item.label || 'Deterministic Simulation Fixture',
        },
        payload: {
          ...item.payload,
          simulatedLabel: item.label || 'SIMULATED DATA',
        },
      });

      events.push(event);
    }

    return events;
  }
}
