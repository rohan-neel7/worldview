import { USGSAdapter } from './USGSAdapter.js';
import { OpenSkyAdapter } from './OpenSkyAdapter.js';
import { CelesTrakAdapter } from './CelesTrakAdapter.js';
import { AISStreamAdapter } from './AISStreamAdapter.js';
import { OpenMeteoAdapter } from './OpenMeteoAdapter.js';
import { MilitaryAdsbAdapter } from './MilitaryAdsbAdapter.js';
import { SimulationAdapter } from './SimulationAdapter.js';
import { IMDWeatherAdapter, IMDWarningAdapter, IMDCycloneAdapter } from './IMDAdapter.js';
import { SACHETAdapter } from './SACHETAdapter.js';
import { GDACSAdapter } from './GDACSAdapter.js';
import { FIRMSAdapter } from './FIRMSAdapter.js';

export {
  USGSAdapter,
  OpenSkyAdapter,
  CelesTrakAdapter,
  AISStreamAdapter,
  OpenMeteoAdapter,
  MilitaryAdsbAdapter,
  SimulationAdapter,
  IMDWeatherAdapter,
  IMDWarningAdapter,
  IMDCycloneAdapter,
  SACHETAdapter,
  GDACSAdapter,
  FIRMSAdapter,
};

export class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
    this.register('USGS', new USGSAdapter());
    this.register('OpenSky', new OpenSkyAdapter());
    this.register('CelesTrak', new CelesTrakAdapter());
    this.register('AISStream', new AISStreamAdapter());
    this.register('OpenMeteo', new OpenMeteoAdapter());
    this.register('adsb.lol', new MilitaryAdsbAdapter());
    this.register('SIMULATION', new SimulationAdapter());
    this.register('IMD_WEATHER', new IMDWeatherAdapter());
    this.register('IMD_WARNINGS', new IMDWarningAdapter());
    this.register('IMD_CYCLONE', new IMDCycloneAdapter());
    this.register('SACHET', new SACHETAdapter());
    this.register('GDACS', new GDACSAdapter());
    this.register('NASA_FIRMS', new FIRMSAdapter());
  }

  register(key, adapterInstance) {
    this.adapters.set(key.toUpperCase(), adapterInstance);
  }

  get(key) {
    return this.adapters.get(key.toUpperCase()) || null;
  }

  /**
   * Normalizes raw data through a registered adapter by key.
   *
   * @param {string} adapterKey
   * @param {any} rawData
   * @param {object} [context={}]
   * @returns {{ events: Array<object>, error: string|null, count: number }}
   */
  normalize(adapterKey, rawData, context = {}) {
    const adapter = this.get(adapterKey);
    if (!adapter) {
      return { events: [], error: `Unknown adapter: "${adapterKey}"`, count: 0 };
    }
    return adapter.safeNormalize(rawData, context);
  }
}

export const defaultAdapterRegistry = new AdapterRegistry();
