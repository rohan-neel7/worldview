import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { BoundedCacheStore } from './store.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3001;

// Stores & Caches
const apiCache = new BoundedCacheStore({ maxItems: 200 });

// Global Counters & Concurrency Controls
let activeGeminiRequests = 0;
const MAX_CONCURRENT_GEMINI = 2;
let geminiDailyCount = 0;
let lastResetDate = new Date().getUTCDate();

function checkDailyReset() {
  const currentDate = new Date().getUTCDate();
  if (currentDate !== lastResetDate) {
    geminiDailyCount = 0;
    lastResetDate = currentDate;
  }
}

const MAX_GEMINI_DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT || '500', 10);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Rate Limiters (Per-IP in-memory limiters)
// Note: In-memory limits apply per-instance. For horizontal multi-instance scaling, swap with Redis store.
const geminiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too Many Requests', message: 'Gemini request rate limit exceeded for this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too Many Requests', message: 'API request limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);

// ============================================================================
// 1. AISSTREAM MARITIME SHIP CONSUMER (Background WS Worker + REST API)
// ============================================================================
const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const vesselMap = new Map();
let aisWs = null;
let aisReconnectTimer = null;

const REGION_BBOXES = {
  GLOBAL: [[[-90, -180], [90, 180]]],
  AMERICAS: [[[-60, -170], [75, -30]]],
  EUROPE: [[[30, -15], [72, 45]]],
  ASIA_PACIFIC: [[[-50, 60], [55, 180]]],
  MIDDLE_EAST: [[[10, 25], [42, 65]]],
  AFRICA: [[[-38, -20], [38, 55]]],
};

function connectAISStream() {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) {
    console.warn('[AISStream Worker] ⚠️ AISSTREAM_API_KEY is not configured in environment.');
    return;
  }

  try {
    aisWs = new WebSocket(AISSTREAM_URL);

    aisWs.on('open', () => {
      console.log('[AISStream Worker] Connected to AISStream WebSocket');
      aisWs.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: REGION_BBOXES.GLOBAL,
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      }));
    });

    aisWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const meta = msg.MetaData;
        if (!meta) return;

        const mmsi = String(meta.MMSI);
        const existing = vesselMap.get(mmsi) || {};

        if (msg.MessageType === 'PositionReport') {
          const pos = msg.Message?.PositionReport;
          if (!pos) return;
          const lat = pos.Latitude;
          const lon = pos.Longitude;
          if (lat === undefined || lon === undefined || (lat === 0 && lon === 0)) return;
          if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;

          vesselMap.set(mmsi, {
            ...existing,
            mmsi,
            name: meta.ShipName?.trim() || existing.name || mmsi,
            lat,
            lon,
            speed: pos.Sog ?? existing.speed ?? 0,
            heading: pos.TrueHeading !== 511 ? pos.TrueHeading : (pos.Cog ?? existing.heading ?? 0),
            course: pos.Cog ?? existing.course ?? 0,
            navStatus: pos.NavigationalStatus ?? existing.navStatus,
            shipType: meta.ShipType ?? existing.shipType,
            lastUpdate: Date.now(),
          });
        } else if (msg.MessageType === 'ShipStaticData') {
          const sd = msg.Message?.ShipStaticData;
          vesselMap.set(mmsi, {
            ...existing,
            mmsi,
            name: meta.ShipName?.trim() || sd?.Name?.trim() || existing.name || mmsi,
            shipType: sd?.Type ?? meta.ShipType ?? existing.shipType,
            destination: sd?.Destination?.trim() || existing.destination,
            callsign: sd?.CallSign?.trim() || existing.callsign,
            lastUpdate: existing.lastUpdate || Date.now(),
          });
        }

        // Keep map bounded to max 500 vessels
        if (vesselMap.size > 600) {
          const entries = [...vesselMap.entries()]
            .sort((a, b) => b[1].lastUpdate - a[1].lastUpdate)
            .slice(0, 500);
          vesselMap.clear();
          entries.forEach(([k, v]) => vesselMap.set(k, v));
        }
      } catch (e) {
        // Skip malformed messages
      }
    });

    aisWs.on('error', (err) => {
      console.error('[AISStream Worker] Error:', err.message);
    });

    aisWs.on('close', () => {
      console.log('[AISStream Worker] WebSocket closed. Reconnecting in 10s...');
      aisReconnectTimer = setTimeout(connectAISStream, 10000);
    });
  } catch (err) {
    console.error('[AISStream Worker] Failed to start:', err.message);
  }
}

// Start AISStream worker on server start
connectAISStream();

// Periodically clean stale vessels (older than 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [mmsi, v] of vesselMap.entries()) {
    if (now - v.lastUpdate > 5 * 60 * 1000) {
      vesselMap.delete(mmsi);
    }
  }
}, 30000);

// Endpoint: GET /api/ships
app.get('/api/ships', (req, res) => {
  const region = (req.query.region || 'GLOBAL').toString().toUpperCase();
  const cacheKey = `ships:${region}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  const list = [...vesselMap.values()]
    .filter(v => v.lat !== undefined && v.lon !== undefined)
    .map(v => ({
      id: v.mmsi,
      mmsi: v.mmsi,
      name: v.name || v.mmsi,
      lat: v.lat,
      lon: v.lon,
      speed: v.speed || 0,
      heading: v.heading || v.course || 0,
      course: v.course || 0,
      shipType: v.shipType || 'Unknown',
      destination: v.destination || '--',
      callsign: v.callsign || '--',
      navStatus: v.navStatus,
    }));

  const responseData = { ships: list, count: list.length, timestamp: Date.now() };
  apiCache.set(cacheKey, responseData, 3000); // 3 second cache
  res.json(responseData);
});

// ============================================================================
// 2. GEMINI CRISIS INTELLIGENCE ENDPOINT
// ============================================================================
app.post('/api/gemini', geminiLimiter, async (req, res, next) => {
  try {
    checkDailyReset();

    // Global daily ceiling check
    if (geminiDailyCount >= MAX_GEMINI_DAILY_LIMIT) {
      return res.status(429).json({
        error: 'Global Limit Exceeded',
        message: 'Global daily AI quota reached. System intelligence is temporarily running in offline mode.'
      });
    }

    // Global concurrency check
    if (activeGeminiRequests >= MAX_CONCURRENT_GEMINI) {
      return res.status(530).json({
        error: 'Server Busy',
        message: 'Maximum concurrent AI requests processing. Please retry in a few seconds.'
      });
    }

    // Request Validation & Parameter Normalization
    const { flightCount = 0, quakeCount = 0, satCount = 0, topQuake = '', selectedRegion = 'Global' } = req.body || {};

    const normFlight = Math.min(Math.max(0, parseInt(flightCount, 10) || 0), 5000);
    const normQuake = Math.min(Math.max(0, parseInt(quakeCount, 10) || 0), 5000);
    const normSat = Math.min(Math.max(0, parseInt(satCount, 10) || 0), 5000);
    const ALLOWED_REGIONS = ['Global', 'Americas', 'Europe', 'Asia Pacific', 'Middle East', 'Africa'];
    const normRegion = ALLOWED_REGIONS.includes(selectedRegion) ? selectedRegion : 'Global';
    const normTopQuake = String(topQuake).slice(0, 100).replace(/[^\w\s.,-]/g, '');

    // Build Cache Key from Normalized Parameters
    const cacheKey = `gemini:${normRegion}:${normFlight}:${normQuake}:${normSat}:${normTopQuake}`;
    const cachedOutput = apiCache.get(cacheKey);
    if (cachedOutput) {
      return res.json({ intelligence: cachedOutput, cached: true });
    }

    // Server-Side Prompt Template Generation
    const prompt = `You are WORLDVIEW CRISIS ANALYST — a military intelligence AI.
[PRIORITY: HIGH/MED/LOW] Situation. Action. Impact.

Rules:
- Under 40 words total
- Use specific location names
- Never say "I" or "As an AI"
- No generic advice — be precise and actionable
- HIGH = imminent threat, MED = developing situation, LOW = routine

Snapshot:
- Active flights: ${normFlight}
- Active satellites: ${normSat}
- Earthquakes (24h): ${normQuake}
- Top seismic event: ${normTopQuake || 'no significant events'}
- Region: ${normRegion}`;

    const apiKey1 = process.env.GEMINI_API_KEY_1;
    const apiKey2 = process.env.GEMINI_API_KEY_2;

    if (!apiKey1 && !apiKey2) {
      return res.json({
        intelligence: '[PRIORITY: LOW] Intelligence feed offline. Gemini API key not configured on server.',
        fallback: true
      });
    }

    activeGeminiRequests++;
    geminiDailyCount++;

    const getRequestBody = () => JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
    });

    let geminiRes = null;
    const model1 = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const model2 = 'gemini-3.5-flash';

    try {
      // Call primary API key with active model (gemini-flash-latest)
      if (apiKey1) {
        geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model1}:generateContent?key=${apiKey1}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: getRequestBody(),
            signal: AbortSignal.timeout(8000)
          }
        );
      }

      // Fallback model/key call if primary returned an error
      if ((!geminiRes || !geminiRes.ok) && (apiKey1 || apiKey2)) {
        const key = apiKey2 || apiKey1;
        geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model2}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: getRequestBody(),
            signal: AbortSignal.timeout(8000)
          }
        );
      }
    } finally {
      activeGeminiRequests = Math.max(0, activeGeminiRequests - 1);
    }

    if (!geminiRes || !geminiRes.ok) {
      throw new Error(`Upstream Gemini API returned status ${geminiRes?.status || 'network_error'}`);
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();

    if (!text) {
      throw new Error('Invalid output format from Gemini');
    }

    const trimmed = text.trim();
    apiCache.set(cacheKey, trimmed, 30000); // 30 second cache for identical inputs

    res.json({ intelligence: trimmed, cached: false });
  } catch (err) {
    console.error('[Gemini Proxy Error]:', err.message);
    res.json({
      intelligence: '[PRIORITY: LOW] Intelligence feed offline. Upstream connection unavailable.',
      fallback: true
    });
  }
});

// ============================================================================
// 3. PUBLIC DATA PROXIES (OpenSky, CelesTrak, USGS, Open-Meteo)
// ============================================================================

// GET /api/flights
app.get('/api/flights', async (req, res) => {
  const region = (req.query.region || 'GLOBAL').toString().toUpperCase();
  const cacheKey = `flights:${region}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const openSkyUrl = 'https://opensky-network.org/api/states/all';
    const upstreamRes = await fetch(openSkyUrl, { signal: AbortSignal.timeout(8000) });
    if (!upstreamRes.ok) throw new Error(`OpenSky status ${upstreamRes.status}`);

    const data = await upstreamRes.json();
    apiCache.set(cacheKey, data, 10000); // 10 second cache to avoid OpenSky IP bans
    res.json(data);
  } catch (err) {
    console.error('[Flights Proxy Error]:', err.message);
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to fetch flight data from upstream provider.' });
  }
});

// GET /api/satellites
app.get('/api/satellites', async (req, res) => {
  const cacheKey = 'satellites:tle';
  const cached = apiCache.get(cacheKey);
  if (cached) return res.send(cached);

  try {
    const celestrakUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
    const upstreamRes = await fetch(celestrakUrl, { signal: AbortSignal.timeout(10000) });
    if (!upstreamRes.ok) throw new Error(`CelesTrak status ${upstreamRes.status}`);

    const text = await upstreamRes.text();
    apiCache.set(cacheKey, text, 60 * 60 * 1000); // 1 hour cache
    res.header('Content-Type', 'text/plain').send(text);
  } catch (err) {
    console.error('[Satellites Proxy Error]:', err.message);
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to fetch satellite TLE data.' });
  }
});

// GET /api/earthquakes
app.get('/api/earthquakes', async (req, res) => {
  const cacheKey = 'earthquakes:feed';
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const usgsUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';
    const upstreamRes = await fetch(usgsUrl, { signal: AbortSignal.timeout(8000) });
    if (!upstreamRes.ok) throw new Error(`USGS status ${upstreamRes.status}`);

    const data = await upstreamRes.json();
    apiCache.set(cacheKey, data, 5 * 60 * 1000); // 5 minute cache
    res.json(data);
  } catch (err) {
    console.error('[Earthquakes Proxy Error]:', err.message);
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to fetch earthquake feed.' });
  }
});

// GET /api/weather
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Bad Request', message: 'lat and lon are required' });

  const normLat = parseFloat(lat).toFixed(1);
  const normLon = parseFloat(lon).toFixed(1);
  const cacheKey = `weather:${normLat}:${normLon}`;
  const cached = apiCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${normLat}&longitude=${normLon}&current_weather=true`;
    const upstreamRes = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!upstreamRes.ok) throw new Error(`Open-Meteo status ${upstreamRes.status}`);

    const data = await upstreamRes.json();
    apiCache.set(cacheKey, data, 15 * 60 * 1000); // 15 minute cache
    res.json(data);
  } catch (err) {
    console.error('[Weather Proxy Error]:', err.message);
    res.status(502).json({ error: 'Bad Gateway', message: 'Failed to fetch weather data.' });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    cacheItems: apiCache.size(),
    vesselsTracked: vesselMap.size,
    geminiDailyCount,
  });
});

// Serve static frontend in production
const distPath = path.join(projectRoot, 'dist');
app.use(express.static(distPath));
app.get('{*path}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Sanitized Global Error Handler (No stack traces or secret leaks)
app.use((err, req, res, next) => {
  console.error('[Server Internal Error]:', err.message);
  res.status(500).json({ error: 'Internal Server Error', message: 'An internal server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Worldview API Proxy Server running on port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});
