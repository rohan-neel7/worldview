import { BaseAdapter } from './BaseAdapter.js';
import { createEnvironmentalObservation } from '../event/CanonicalEvent.js';
import { EventType, SourceMode } from '../event/types.js';

export class OpenMeteoAdapter extends BaseAdapter {
  constructor() {
    super('Open-Meteo', 'api.open-meteo.com/v1/forecast');
  }

  /**
   * @param {object|Array} rawData - Open-Meteo response
   * @param {object} [context={}] - { lat, lon, sourceMode }
   * @returns {Array<object>}
   */
  normalize(rawData, context = {}) {
    const sourceMode = context.sourceMode || SourceMode.LIVE;
    const receivedAt = context.receivedAt || new Date().toISOString();
    const processedAt = new Date().toISOString();

    if (!rawData || typeof rawData !== 'object') {
      return [];
    }

    let cw = rawData.current_weather || rawData;
    let lat = rawData.latitude !== undefined ? rawData.latitude : context.lat;
    let lon = rawData.longitude !== undefined ? rawData.longitude : context.lon;

    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return [];
    }

    const temperatureC = typeof cw.temperature === 'number' ? cw.temperature : null;
    const windSpeedKmh = typeof cw.windspeed === 'number' ? cw.windspeed : (typeof cw.windSpeed === 'number' ? cw.windSpeed : 0);
    const windSpeedMps = BaseAdapter.kmhToMps(windSpeedKmh);
    const windDirectionDeg = typeof cw.winddirection === 'number' ? cw.winddirection : (cw.windDirection || 0);
    const weatherCode = typeof cw.weathercode === 'number' ? cw.weathercode : (cw.weatherCode || 0);
    const precipitationMm = typeof cw.precipitation === 'number' ? cw.precipitation : (typeof rawData.precipitation === 'number' ? rawData.precipitation : 0);
    const precipitationRateMmH = typeof cw.precipitationRate === 'number' ? cw.precipitationRate : precipitationMm;

    const observedAt = cw.time ? new Date(cw.time).toISOString() : new Date().toISOString();
    const latNorm = Number(lat.toFixed(2));
    const lonNorm = Number(lon.toFixed(2));

    const event = createEnvironmentalObservation({
      id: `meteo:${latNorm}:${lonNorm}:${observedAt.slice(0, 13)}`,
      source: this.sourceName,
      sourceMode,
      type: EventType.WEATHER,
      observedAt,
      receivedAt,
      processedAt,
      location: {
        lat: Number(lat.toFixed(5)),
        lon: Number(lon.toFixed(5)),
        altMeters: 0,
      },
      confidence: 0.95,
      maxAgeMs: 60 * 60 * 1000, // 1 hour
      provenance: {
        providerEventId: `${latNorm},${lonNorm}`,
        providerEndpoint: this.endpoint,
        version: this.version,
        originalRef: `lat=${latNorm}&lon=${lonNorm}`,
      },
      payload: {
        temperatureC,
        windSpeedMps,
        windSpeedKmh,
        windDirectionDeg,
        weatherCode,
        precipitationMm,
        precipitationRateMmH,
      },
    });

    return [event];
  }
}
