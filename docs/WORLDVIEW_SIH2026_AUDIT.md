# WORLDVIEW — SIH 2026 DISASTER MANAGEMENT
## Phase 1: Architecture, Data & Product Audit

---

# PART 1 — CURRENT SYSTEM AUDIT

Based on a comprehensive inspection of the repository (including `package.json`, `server/index.js`, `server/store.js`, `src/App.jsx`, `src/WorldViewContext.jsx`, `src/components/GlobeViewer.jsx`, `src/hooks/*`, `src/workers/*`, and `worldview.css`), here is the verified inventory of the current system:

### 1.1 Technology Stack

```
[Browser Client: React 19 + CesiumJS 1.139 + Web Workers + Tailwind v4]
                              ↕ (HTTP / REST)
[Node.js Express 5.2 Reverse Proxy & In-Memory LRU Cache Store]
           ↕ (REST)                               ↕ (WebSocket Client)
[USGS / OpenSky / CelesTrak / Open-Meteo / Gemini Pro]      [AISStream.io]
```

* **Frontend Framework:** React 19.2.0 (`react`, `react-dom`).
* **Programming Languages:** JavaScript (ESModules throughout client and server), GLSL (WebGL2 / GLSL 300es for Cesium post-processing shaders).
* **Runtime & Build System:** Node.js (v20+ recommended), Vite 7.3.1 with `@vitejs/plugin-react` and `vite-plugin-cesium` 1.2.23.
* **Package Manager:** `npm` (configured with `--legacy-peer-deps` due to React 19 vs. Resium peer metadata).
* **Core Libraries:**
  * `cesium` (1.139.1) — Primary 3D Geospatial Engine.
  * `resium` (1.19.4) — *Installed but deliberately bypassed* (raw Cesium API is used directly to prevent re-render thrashing and overhead).
  * `satellite.js` (6.0.2) — SGP4/SDP4 orbital propagation in Web Workers.
  * `@google/generative-ai` (0.24.1) — Gemini AI SDK (backend proxy fetch).
  * `lucide-react` (1.7.0) — Tactical HUD vector icons.
  * `@tailwindcss/vite` (4.2.1) — Tailwind CSS v4 styling engine.
  * `express` (5.2.1) + `cors` + `dotenv` + `express-rate-limit` (8.6.1) + `ws` (8.21.1).
* **Visualization Engine:** Raw CesiumJS `Viewer` mounted inside `GlobeViewer.jsx` rendered inside a circular tactical viewport (`.globe-wrapper` with vignette mask). Uses:
  * Google Maps Tile Imagery (`https://mt1.google.com/vt/lyrs=s...`).
  * Google Photorealistic 3D Tiles (`Cesium.createGooglePhotorealistic3DTileset`) conditionally mounted at altitude < 150 km.
  * Real-time sun-based dynamic atmospheric lighting and sky atmosphere.
  * WebGL2 post-processing stages for CRT, NVG, FLIR, NOIR, SNOW, Sharpen, and Atmospheric Bloom.
* **Backend:** Lightweight Node.js Express server (`worldview/server/index.js`) running on port 3001. Handles:
  * Persistent WebSocket client connection to `wss://stream.aisstream.io/v0/stream`.
  * Rate-limiting proxy for OpenSky, CelesTrak, USGS, and Open-Meteo.
  * Secure server-side Gemini Pro API gateway with daily quota ceiling and concurrency limiting.
  * Production static file hosting for Vite's `dist/`.
* **State Management:** React Context (`WorldViewContext.jsx`) for global UI toggles, region selection, camera coordinates, data counts, active visual presets, and HUD layout. Zero `localStorage` or `sessionStorage` persistence (strictly ephemeral memory).
* **Concurrency & Workers:**
  * `satelliteWorker.js`: Offloads TLE parsing and per-frame SGP4 propagation from the main UI thread.
  * `animationWorker.js`: Runs a 30 FPS dead-reckoning simulation loop for aircraft and propagated satellites, streaming packed `Float64Array` typed buffers over `postMessage`.
* **Caching & Rate Limiting:**
  * Custom `BoundedCacheStore` (`server/store.js`): In-memory LRU with item count limits (200 items) and individual TTLs (OpenSky: 10s, CelesTrak: 1h, USGS: 5m, Open-Meteo: 15m, AIS ships: 3s, Gemini: 30s).
  * `express-rate-limit`: Per-IP limiters on Gemini (120 req/15min) and general endpoints (600 req/1min).
  * Concurrency guard: Max 2 concurrent Gemini executions and a 500 calls/day hard ceiling.
* **Environment Variables:**
  * `VITE_GOOGLE_MAPS_KEY` (Browser-exposed Google 3D Tiles key).
  * `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2` (Server-side Gemini keys with fallback).
  * `AISSTREAM_API_KEY` (Server-side maritime WebSocket credentials).
  * `PORT`, `GEMINI_DAILY_LIMIT`.

---

### 1.2 Architecture Data Flow

```
[External Sources]
   ├─ AISStream WebSocket ───────► Express Background Worker ──► In-Memory vesselMap (Max 500) ──► GET /api/ships
   ├─ OpenSky Network REST ──────► Express In-Memory LRU Proxy (10s TTL) ─────────────────────────► GET /api/flights
   ├─ CelesTrak GP REST ─────────► Express In-Memory LRU Proxy (1h TTL) ──────────────────────────► GET /api/satellites
   ├─ USGS Earthquake Feed ──────► Express In-Memory LRU Proxy (5m TTL) ──────────────────────────► GET /api/earthquakes
   ├─ Open-Meteo Forecast ───────► Express In-Memory LRU Proxy (15m TTL) ─────────────────────────► GET /api/weather
   └─ Google Generative AI ──────► Express Proxy (Rate-limited, Concurrency=2, Cache=30s) ────────► POST /api/gemini
                                                                                                            │
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
▼
[React 19 Frontend Hooks] (Staggered fetch intervals: useFlights, useSatellites, useEarthquakes, useShips, useWeather, useGemini)
│
▼
[App.jsx & WorldViewContext] (Ephemeral state: arrays down, selection callbacks up)
│
├──► [Web Worker Pool]
│       ├── satelliteWorker.js (TLE Propagation)
│       └── animationWorker.js (30 FPS Dead-Reckoning Math via Float64Array)
│
└──► [GlobeViewer.jsx (Raw CesiumJS)]
        ├── PointPrimitiveCollection (Earthquakes: Mapped/Batched GPU Points with Magnitude-based Color & Pulsing)
        ├── BillboardCollection (Flights: Custom Canvas Vector Aircraft + Dead-Reckoned Coordinates)
        ├── BillboardCollection (Satellites: Tactical Canvas Reticles)
        ├── BillboardCollection (Ships: Directional Vessel Canvas)
        ├── Google Photorealistic 3D Tileset (Altitude < 150km)
        └── PostProcessStage Pipeline (CRT / NVG / FLIR / Bloom / Sharpen in GLSL 300es)
```

---

# PART 2 — EXISTING DATA SOURCES AUDIT

| Source | Data Description | Protocol | Current Implementation | Update Frequency | Reliability | Disaster Relevance | Classification |
|---|---|---|---|---|---|---|---|
| **USGS Earthquake API** | Global seismic events (magnitude, depth, epicenter, timestamp, place name) | REST (GeoJSON) | Backend proxy `/api/earthquakes` with direct fallback to USGS GeoJSON feed. Bounded by regional bbox and top 100 quakes. | Polled every 5 minutes (`300000ms`) | **High** (Public USGS CDN, standard GeoJSON) | Primary hazard feed for seismic events, ground motion triggers, and secondary tsunami risks. | **CORE** |
| **OpenSky Network** | Global civilian ADS-B aircraft telemetry (ICAO24, callsign, lat, lon, alt, speed, heading) | REST (JSON) | Backend proxy `/api/flights` with fallback to static `/data/active-flights.json`. Filtered by region bbox and capped at 35–100. Animated via dead-reckoning worker. | Polled every 10s (`10000ms`) | **Medium-Low** (Anonymous API subject to severe IP rate limits; mitigated by server LRU cache & local JSON fallback) | Airspace clearance during cyclones/volcanic ash, search-and-rescue airspace deconfliction, airborne relief corridors, airport accessibility. | **SECONDARY** |
| **adsb.lol** | Military ADS-B transponder telemetry | REST (JSON) | Frontend hook `useMilitaryFlights` querying `/api/adsb/v2/mil`. | Polled every 30s (`30000ms`) | **Medium** (Community ADSB exchange) | Military transport deployment, disaster relief airdrops, National Disaster Response Force (NDRF) / Coast Guard airborne tracking. | **SECONDARY** |
| **CelesTrak** | Active satellite Two-Line Element (TLE) orbital ephemerides | REST (Plaintext) | Backend proxy `/api/satellites` with fallback to `/data/active-satellites.txt`. Propagated client-side via `satellite.js` in a Dedicated Worker. Capped at 200. | TLE polled every 1 hr; SGP4 propagated every 30s + 30 FPS worker | **High** (Cached TLEs propagate accurately for 24–48h) | Situational awareness of Earth Observation (EO) satellite coverage (Sentinel, Landsat, RISAT), synthetic aperture radar (SAR) flyover prediction, emergency satellite communication links. | **HIGH** |
| **AISStream.io** | Real-time global maritime vessel transponder telemetry (MMSI, position, speed, heading, vessel type, destination) | WebSocket (JSON) | Server daemon worker maintaining persistent WebSocket connection and in-memory `vesselMap` (max 500). Exposes `/api/ships`. | Continuous live stream push; REST polled by UI every 3s | **High** (Official AIS stream with API key authentication) | Maritime search and rescue (SAR), port evacuation, coastal storm surge impact on shipping, oil spills, naval disaster relief vessels. | **HIGH** |
| **Open-Meteo / NOAA NEXRAD** | Global numerical weather predictions & US radar WMS imagery | REST / WMS | Backend proxy `/api/weather` (Open-Meteo) + WMS imagery provider (`useWeather.js`). | Polled every 5–15 minutes | **High** (Open-Meteo has high uptime; NOAA WMS is official US government) | Critical early warning for cyclones, heavy precipitation, flood forecasting, extreme wind conditions, storm tracks. | **CORE** |
| **Google Gemini Pro** | LLM-generated tactical situation dossier and priority ranking | REST (JSON via Google Generative AI) | Server proxy `/api/gemini` with dual-key fallback, regex report parser, 30s cache, and deterministic algorithmic fallback template. | On-demand / 60s auto-refresh | **High** (With dual API keys and procedural fallback) | Explaining disaster dynamics, comparing tactical response options, synthesizing complex multi-layer telemetry for incident commanders. | **HIGH** |

### Justification for Retaining Existing Feeds:
* **Airspace (`OpenSky` / `adsb.lol`)**: When a cyclone or flood hits, civilian airspace closures (NOTAMs) and airborne disaster relief flights (NDRF/Air Force C-130s/Mi-17s) represent critical operational intelligence.
* **Maritime (`AISStream`)**: Cyclones and tsunamis directly threaten maritime assets. Coastal disaster management requires real-time identification of stranded vessels, tugboats, and naval disaster relief assets.
* **Satellites (`CelesTrak`)**: Knowing when an optical or radar satellite (e.g., Sentinel-1 SAR or Cartosat) passes over a flooded or burning area allows the system to schedule near-real-time satellite damage assessments.

---

# PART 3 — DATA GAP ANALYSIS FOR DISASTER MANAGEMENT

To evolve Worldview into a real-time disaster intelligence and response system for SIH 2026, the following data feeds must be integrated.

```
                    ┌────────────────────────────────────────────────────────┐
                    │            WORLDVIEW DISASTER DATA FABRIC              │
                    └────────────────────────────────────────────────────────┘
                                                 │
      ┌──────────────────────┬───────────────────┴──────────────────┬──────────────────────┐
      ▼                      ▼                                      ▼                      ▼
[A. HAZARDS & WARNINGS] [B. EARTH OBSERVATION]             [C. EXPOSURE & ASSETS] [D. RESOURCES & LOGISTICS]
• GDACS Alerts (RSS)   • NASA FIRMS Active Fires (CSV/API) • OpenStreetMap (OSM)  • OSM Overpass (Hospitals,
• USGS Earthquakes     • Sentinel Hub / Copernicus WMS       (Buildings, Roads,     Fire Stations, Shelters)
• Open-Meteo Forecast  • NASA GIBS / MODIS TrueColor WMS      Hospitals, Power)   • OSRM / Valhalla Routing
• IMD / JTWC Cyclones  • Copernicus DEM / Terrain          • WorldPop / GHSL DEM  • Simulated NDRF / SDRF Fleet
```

### Gap Analysis Matrix

| Domain | Data Layer | Public API? | Protocol / Format | Auth Required? | Latency / Frequency | Geographic Coverage | Feasibility for SIH Prototype | Production Alternative |
|---|---|---|---|---|---|---|---|---|
| **A. Hazard** | **GDACS Alerts** (Global Disasters: Floods, Cyclones, Earthquakes, Volcanoes) | Yes (`gdacs.org`) | REST / GeoJSON & RSS | No | 10–30 min | Global | **10/10 (High Priority)** | Official National Feeds (IMD / NDMA / USGS) |
| **A. Hazard** | **NASA FIRMS** (Active Fire Hotspots via VIIRS / MODIS) | Yes (`firms.modaps.eosdis.nasa.gov`) | REST / CSV / GeoJSON | Free API Key | Near-Real-Time (1–3 hours) | Global (375m resolution) | **10/10 (High Priority)** | Local Forest Survey of India (FSI) Van Agni Geo-portal |
| **A. Hazard** | **JTWC / IMD Tropical Cyclone Tracks** | Yes (`IBTrACS` / NOAA NHC / IMD) | REST / GeoJSON / Shapefile | No | 3–6 hours | Global Oceans / North Indian Ocean | **9/10 (High Priority)** | IMD Cyclone e-Atlas |
| **A. Hazard** | **Open-Meteo Flood & Precipitation API** | Yes (`open-meteo.com`) | REST / JSON | No (Free tier) | Hourly / Daily forecasts | Global (11km resolution) | **10/10 (High Priority)** | Copernicus GloFAS / CWC (Central Water Commission India) |
| **B. Earth Observation** | **NASA GIBS Imagery** (MODIS / VIIRS Daily Reflectance) | Yes (`gibs.earthdata.nasa.gov`) | WMTS / TMS Tiles | No | Daily updates | Global | **9/10 (High Priority)** | Sentinel Hub WMS (High Res) |
| **B. Earth Observation** | **Sentinel-1 SAR Flood Inundation Extent** | Yes (Copernicus Browser / OpenEO) | GeoTIFF / WMS | Free Registration | 1–3 days pass time | Global | **7/10 (Pre-cached GeoJSON for prototype)** | ISRO Bhuvan Disaster Services / Copernicus EMS |
| **C. Exposure** | **Critical Infrastructure** (Hospitals, Schools, Fire Stations, Roads, Bridges) | Yes (Overpass API / OpenStreetMap) | REST / GeoJSON (Overpass QL) | No | Static / Daily query | Global | **10/10 (High Priority)** | National Spatial Data Infrastructure (NSDI) |
| **C. Exposure** | **High-Density Population Grids** | Yes (WorldPop / Humanitarian Data Exchange HDX) | GeoTIFF / Raster / Polygons | No | 100m grid (Annual baseline) | Global | **8/10 (Pre-processed GeoJSON/MVT tiles)** | Census of India / GHSL (Global Human Settlement Layer) |
| **D. Emergency Resources** | **Emergency Response Facilities & Assets** (NDRF bases, Fire Brigades, Shelters, Ambulances) | Semi (OSM for locations; Live status is restricted) | REST / GeoJSON | Open for locations; Simulated for live status | Static stations + Real-time simulation | Local / National | **9/10 (Real OSM locations + Simulated dynamic fleet status)** | State Emergency Operation Centers (SEOC) 112 CAD Integration |
| **E. Operational Intelligence** | **Road Network Disruption & Routing** | Yes (OSRM / OpenRouteService) | REST / JSON | No (Self-hosted or Public demo) | Real-time calculation | Global | **9/10 (High Priority)** | Google Routes / Mapbox Traffic API |

---

# PART 4 — DISASTER TYPES & DETECTION METHODOLOGY

To maintain scientific credibility and operational depth, Worldview will target four core disaster classes for SIH 2026.

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              DISASTER TAXONOMY & CAPABILITY                               │
├──────────────┬─────────────────────────────┬──────────────────────────┬───────────────────┤
│ DISASTER     │ DETECTION / TRIGGER         │ EARLY WARNING HORIZON    │ IMPACT ASSESSMENT │
├──────────────┼─────────────────────────────┼──────────────────────────┼───────────────────┤
│ FLOOD        │ Cumulative Rainfall > 100mm │ 24h to 72h (Forecast)    │ Inundation Area,  │
│              │ & River Discharge Anomaly   │ 0h to 6h (Flash Flood)   │ Blocked Arteries  │
├──────────────┼─────────────────────────────┼──────────────────────────┼───────────────────┤
│ CYCLONE      │ JTWC/IMD Track + Pressure   │ 48h to 120h (Cone)       │ Wind Swath, Surge │
│              │ Drop + Extreme Sustained Kt │ 6h to 24h (Landfall)     │ Maritime Risk     │
├──────────────┼─────────────────────────────┼──────────────────────────┼───────────────────┤
│ WILDFIRE     │ VIIRS/MODIS Thermal Hotspot │ 6h to 48h (FWI Index:    │ Burn Perimeter,   │
│              │ Cluster + Brightness Temp   │ High Temp + Low RH)      │ Smoke Plume Path  │
├──────────────┼─────────────────────────────┼──────────────────────────┼───────────────────┤
│ EARTHQUAKE   │ USGS Seismograph P/S Wave   │ Seconds to Minutes (EEW) │ Isoseismal MMI,   │
│              │ Ingestion (M4.5+)           │ 0s (True Pre-detection)  │ Population Shakemap│
└──────────────┴─────────────────────────────┴──────────────────────────┴───────────────────┘
```

### 1. Flood
* **Detection:** Real-time satellite-derived precipitation anomalies (Open-Meteo precipitation > 100mm/24h) coupled with river basin discharge rate exceedance.
* **Early Warning Horizon:** 24–72 hours via numerical weather prediction (NWP) ensemble rainfall accumulation models; 1–6 hours for flash flood threshold exceedance.
* **Confirmation Signals:** NASA/Copernicus SAR backscatter decrease (water surface specular reflection), GDACS flood alert publication, local stream-gauge telemetry.
* **Impact Assessment Data:** Digital Elevation Model (DEM) topographical flow accumulation, OpenStreetMap road network intersections (identifying submerged road links), population density within the flood polygon.
* **Response Requirements:** Watercraft rescue teams (NDRF), high-clearance vehicle staging, flood relief camp capacity, critical hospital power redundancy.
* **Scientific Boundaries:** *We forecast flood risk based on hydrological rainfall-runoff models; we do NOT claim sub-meter street water depth without high-resolution LiDAR.*

### 2. Tropical Cyclone
* **Detection:** JTWC / IMD tropical cyclone bulletin ingestion: Central Barometric Pressure ($P_{min} < 990 \text{ hPa}$), Max Sustained Winds ($V_{max} > 34 \text{ kts}$).
* **Early Warning Horizon:** 48–120 hours track forecasting cone; 12–24 hours for landfall point and gale-force wind swath radius.
* **Confirmation Signals:** Live maritime barometer pressure drops from AIS ships, coastal weather radar (Doppler reflectivity velocity), infrared cloud tops (GOES/INSAT).
* **Impact Assessment Data:** Radius of Maximum Winds (RMW), coastal elevation for storm surge penetration, maritime vessels in danger quadrant, structural vulnerability of building stock.
* **Response Requirements:** Maritime vessel rerouting/anchorage recall, coastal mass evacuation logistics, emergency backup generators, shelter capacity allocation.
* **Scientific Boundaries:** *We display probabilistic track uncertainty cones (cone of uncertainty); we do NOT claim deterministic millimeter landfall coordinates.*

### 3. Wildfire
* **Detection:** NASA FIRMS VIIRS (375m) / MODIS (1km) Active Fire Detection (thermal anomaly detection via Middle Infrared / Thermal Infrared channels).
* **Early Warning Horizon:** 6–48 hours using the Fire Weather Index (FWI) computed from ambient temperature, low relative humidity, wind speed, and drought indices.
* **Confirmation Signals:** Consecutive thermal detections over 6 hours, optical smoke plume identification on satellite imagery, sudden spike in ambient PM2.5/PM10 air quality sensors.
* **Impact Assessment Data:** Fuel bed type, wind direction vector (spreading vector prediction), wildland-urban interface (WUI) proximity, structure count within the 6-hour forward burn perimeter.
* **Response Requirements:** Aerial firefighting retardant drops, fire brigade containment lines, evacuation route clearance downwind, vulnerable population smoke advisories.
* **Scientific Boundaries:** *We predict potential fire spread direction based on surface wind vectors and fuel load; we do NOT claim precise flame boundary containment without real-time UAV/thermal reconnaissance.*

### 4. Earthquake
* **Detection:** USGS Real-Time Seismic Feed (P/S wave triangulation, Moment Magnitude $M_w \ge 4.5$, Hypocenter depth).
* **Early Warning:** Earthquake Early Warning (EEW) provides 5–60 seconds of warning *after* rupture initiation before destructive S/Surface waves arrive at distant population centers.
* **Confirmation Signals:** Multiple seismological network cross-registration (USGS, EMSC, GEOFON), felt-report telemetry ("Did You Feel It?"), immediate secondary tsunami advisory generation for submarine epicenters with $M_w \ge 7.0$.
* **Impact Assessment Data:** Modified Mercalli Intensity (MMI) ShakeMap calculations, depth attenuation, building code vulnerability curves, structural density, proximity to critical fault lines.
* **Response Requirements:** Urban Search & Rescue (USAR) heavy extrication teams, trauma hospital surge capacity, structural collapse triage, emergency power and water distribution.
* **Scientific Boundaries:** *We explicitly DO NOT claim earthquake prediction (time, location, or magnitude before rupture). We deliver rapid post-event impact estimation and Shakemap propagation.*

---

# PART 5 — DATA FUSION ARCHITECTURE

```
RAW EXTERNAL FEEDS (USGS, OpenSky, CelesTrak, AISStream, NASA FIRMS, GDACS, Open-Meteo, OSM)
                                    │
                                    ▼
1. INGESTION & ADAPTER LAYER (Format Decoding, Rate Limit Handling, Schema Unification)
                                    │
                                    ▼
2. VALIDATION & SANITIZATION LAYER (Coordinate Bounds, Sanity Checking, Deduplication)
                                    │
                                    ▼
3. TEMPORAL & SPATIAL ALIGNMENT (WGS84 Canonical Coords, UTC Epoch Timestamping, H3/R-Tree Spatial Indexing)
                                    │
                                    ▼
4. DATA FUSION & CORRELATION ENGINE (Cross-Feed Association: e.g. Seismic Vector + Coastal Depth = Tsunami Threat)
                                    │
                                    ▼
5. ANOMALY DETECTION PIPELINE (Z-Score Baseline Deviations, Physical Threshold Triggers, Cluster Density)
                                    │
                                    ▼
6. DETERMINISTIC RISK ENGINE (Hazard Intensity + Exposure + Vulnerability + Lack of Coping Capacity)
                                    │
                                    ▼
7. CANONICAL INCIDENT GENERATOR (Generates Uniform Worldview Incident Object with Confidence Rating)
```

### Functional Layer Responsibilities:
1. **Ingestion & Adapter Layer:** Decouples external protocols (WebSocket, REST, WMS, GeoJSON, CSV, Plaintext) into standardized raw JSON events. Handles upstream retry logic, backoff, and caching.
2. **Validation & Sanitization Layer:** Enforces geographic integrity ($-90 \le \text{lat} \le 90$, $-180 \le \text{lon} \le 180$), rejects null coordinates, cleans malformed callsigns, drops duplicate transmissions, and strips malicious payload strings.
3. **Temporal & Spatial Alignment Layer:** Normalizes all timestamps to UTC ISO-8601 strings and maps all positions to Earth-Centered WGS84 Cartesian coordinates. Organizes entities into spatial indexing grids (e.g., GeoHash / Spatial Bounding Boxes) for fast proximity lookups.
4. **Data Fusion & Correlation Engine:** Fuses independent data streams. For instance, when an earthquake occurs offshore at depth $<30\text{km}$ with $M_w > 7.0$, it automatically queries AISStream for ships in the coastal zone and requests coastal bathymetry for tsunami propagation risk.
5. **Anomaly Detection Pipeline:** Flags statistical outliers against moving historical baselines (e.g., 24-hour rainfall exceeding 3 standard deviations $\sigma$ above the 30-day average, or air traffic density dropping to zero inside a flight corridor).
6. **Deterministic Risk Engine:** Applies mathematical, reproducible risk formulas to calculate impact scores without relying on non-deterministic LLMs.
7. **Incident Generator:** Promotes validated multi-feed hazard detections into high-priority `Worldview Incident` instances that trigger the UI's **Incident Mode**.

---

# PART 6 — CANONICAL INCIDENT MODEL

Below is the formal, TypeScript-style schema for a canonical Worldview Incident object. Every field exists for a specific operational, analytical, or rendering purpose.

```json
{
  "id": "INC-2026-FL-0891",
  "type": "FLOOD",
  "subtype": "RIVERINE_INUNDATION",
  "status": "ACTIVE",
  "severity": "CRITICAL",
  "confidence": {
    "score": 0.92,
    "level": "HIGH",
    "contributingSources": ["OPEN_METEO", "GDACS", "COPERNICUS_SAR", "OSM_STREAM_NODES"]
  },
  "spatial": {
    "centroid": { "lat": 13.0827, "lon": 80.2707, "alt": 0 },
    "boundingBox": { "minLat": 12.95, "maxLat": 13.20, "minLon": 80.15, "maxLon": 80.35 },
    "geometryType": "POLYGON",
    "coordinates": [[[80.15, 12.95], [80.35, 12.95], [80.35, 13.20], [80.15, 13.20], [80.15, 12.95]]]
  },
  "temporal": {
    "detectedAt": "2026-08-18T16:45:00Z",
    "lastUpdatedAt": "2026-08-18T18:00:00Z",
    "peakEstimatedAt": "2026-08-19T06:00:00Z",
    "estimatedDurationHours": 48
  },
  "hazardMetrics": {
    "primaryMetric": { "name": "PRECIPITATION_24H", "value": 184.5, "unit": "mm", "threshold": 100.0 },
    "secondaryMetrics": [
      { "name": "RIVER_DISCHARGE_ANOMALY", "value": "+240%", "status": "EXTREME" },
      { "name": "SURFACE_WATER_EXTENT", "value": 42.8, "unit": "km2" }
    ]
  },
  "exposureAssessment": {
    "exposedPopulation": 142000,
    "vulnerablePopulation": 28400,
    "criticalInfrastructure": {
      "hospitalsThreatened": 4,
      "schoolsInZone": 18,
      "powerSubstations": 2,
      "bridgesAtRisk": 6
    },
    "transportDisruptions": {
      "blockedRoadSegments": 14,
      "airportOperationalStatus": "RESTRICTED",
      "railwayCorridorsFlooded": 2
    }
  },
  "riskCalculation": {
    "compositeRiskScore": 86.4,
    "hazardScore": 90.0,
    "exposureScore": 85.0,
    "vulnerabilityScore": 82.0,
    "copingCapacityScore": 35.0,
    "riskBreakdown": [
      { "factor": "Rainfall Intensity (>180mm)", "impactPoints": 35 },
      { "factor": "High Urban Population Density", "impactPoints": 25 },
      { "factor": "Major Road Artery Inundation", "impactPoints": 15 },
      { "factor": "Hospital Accessibility Degradation", "impactPoints": 11.4 }
    ]
  },
  "resourceOptimization": {
    "requirements": {
      "rescueBoats": 25,
      "ambulances": 40,
      "evacuationShelters": 12,
      "emergencyFoodKits": 20000
    },
    "availableWithin1Hour": {
      "rescueBoats": 14,
      "ambulances": 28,
      "evacuationShelters": 9
    },
    "resourceGap": {
      "rescueBoats": -11,
      "ambulances": -12,
      "evacuationShelters": -3
    }
  },
  "responseOptions": [
    {
      "id": "OPT-A",
      "name": "RAPID CIVIC EVACUATION",
      "priority": "HIGH",
      "etaMinutes": 45,
      "resourceCost": "HIGH",
      "projectedCasualityReduction": "85%",
      "tradeoffs": "Requires immediate shutdown of South Transit Corridor to allow one-way outbound evacuation."
    },
    {
      "id": "OPT-B",
      "name": "DEFENSIVE CONTAINMENT & IN-PLACE SHELTERING",
      "priority": "BALANCED",
      "etaMinutes": 90,
      "resourceCost": "MODERATE",
      "projectedCasualityReduction": "60%",
      "tradeoffs": "Lower transport burden; requires high reliance on multi-story school shelters with emergency power."
    }
  ],
  "intelligenceContext": {
    "relevantFeeds": {
      "flights": { "relevance": "HIGH", "reason": "Air medical evacuation & NDRF helicopter flight corridor clearance" },
      "satellites": { "relevance": "HIGH", "reason": "Copernicus Sentinel-1 SAR pass scheduled in 4.2 hours" },
      "ships": { "relevance": "LOW", "reason": "Inland river basin; maritime coastal ships out of immediate impact" },
      "earthquakes": { "relevance": "NONE", "reason": "No correlated seismic activity" }
    }
  },
  "timeline": [
    { "timestamp": "2026-08-18T16:45:00Z", "event": "Precipitation trigger reached (100mm threshold exceeded)." },
    { "timestamp": "2026-08-18T17:15:00Z", "event": "GDACS published orange flood warning for river basin." },
    { "timestamp": "2026-08-18T18:00:00Z", "event": "Incident promoted to CRITICAL following road network flood overlap." }
  ]
}
```

### Why Each Field Exists:
* `confidence`: Distinguishes between single-feed anomalies (e.g., faulty rain gauge) and cross-validated multi-sensor disasters.
* `hazardMetrics`: Retains ground-truth physical units (mm, kts, $M_w$, MW) for operator verification.
* `riskCalculation.riskBreakdown`: Enables the UI to display the exact mathematical "Why?" breakdown without relying on LLM guesswork.
* `intelligenceContext.relevantFeeds`: Allows the UI to automatically highlight or dim live layers based on the selected disaster type.

---

# PART 7 — MATHEMATICAL & EXPLAINABLE RISK ENGINE

To avoid black-box AI hallucination and comply with scientific disaster standards (UNDRR / INFORM Risk Index), Worldview utilizes an explainable, deterministic risk formulation:

$$\text{Risk Score} = \left( \frac{\text{Hazard} \times \text{Exposure} \times \text{Vulnerability}}{\text{Coping Capacity}} \right)^{\frac{1}{3}} \times \text{Confidence Factor}$$

Where all base components are normalized to scale $[0, 100]$:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DETERMINISTIC RISK PIPELINE                       │
└────────────────────────────────────────────────────────────────────────┘
  │
  ├──► 1. HAZARD INTENSITY (H): Physical magnitude (mm rain, wind kts, Richter Mw, Fire Radiative Power MW)
  │
  ├──► 2. EXPOSURE (E): Population count + Critical asset density within spatial damage footprint
  │
  ├──► 3. VULNERABILITY (V): Infrastructure fragility, building types, drainage index, slum/informal density
  │
  ├──► 4. COPING CAPACITY (C): Proximity of NDRF bases, hospital bed availability, evacuation route density
  │
  └──► 5. CONFIDENCE FACTOR (k): Weight based on sensor corroboration (1.0 = multi-feed, 0.6 = single unconfirmed feed)
```

### Concrete Explainability Output:
Instead of a vague "Danger: High" output, the operator HUD presents an exact point attribution breakdown:

```
[RISK SCORE: 86.4 / 100 — CRITICAL]
===========================================================
CONTRIBUTING ATTRIBUTION:
+ 35.0 pts | Hazard: Extreme 24h Rainfall (184.5 mm vs 100mm baseline)
+ 25.0 pts | Exposure: High Population Density (142,000 in inundation zone)
+ 15.0 pts | Vulnerability: Low-Lying Drainage Basin + 14 Arterial Road Cuts
+ 11.4 pts | Coping Gap: 4 Threatened Hospitals with Reduced Ambulance Ingress
- 10.0 pts | Mitigation: 9 Evacuation Shelters Active Within 5km
===========================================================
DETERMINISTIC CONFIDENCE: 92% (Corroborated across 4 telemetry feeds)
```

---

# PART 8 — EARLY WARNING ARCHITECTURE & TAXONOMY

Worldview enforces a strict scientific taxonomy to prevent overclaiming disaster prediction capabilities:

```
TIMELINE: BEFORE OCCURRENCE ────────────────────────► DURING OCCURRENCE ───────────────► POST EVENT
                 │                                             │                               │
                 ▼                                             ▼                               ▼
      [HAZARD FORECAST]                              [EVENT DETECTION]                [IMPACT FORECAST]
      Numerical model predictions                    Sensor confirms rupture/         Geospatial overlap of
      (e.g., 72h Cyclone Cone,                       landfall/ignition in real-time   damage footprint with
      NWP 48h Rain Accumulation)                     (USGS Seismograph, VIIRS Fire)   population & infrastructure
                 │                                             │                               │
                 ▼                                             ▼                               ▼
      [ANOMALY DETECTION]                            [EARLY WARNING (EEW)]
      Deviations from moving baseline                Seconds-to-hours warning for
      (e.g., 24h Rain > 3σ above norm)               unimpacted downwind/downstream areas
```

### Scientific Taxonomy Boundaries:

| Category | Definition | Flood Capability | Cyclone Capability | Wildfire Capability | Earthquake Capability |
|---|---|---|---|---|---|
| **1. Hazard Forecast** | Multi-day numerical simulation of impending conditions. | **Supported** (72h NWP rain models) | **Supported** (120h JTWC/IMD track cones) | **Supported** (48h Fire Weather Index) | **NOT SUPPORTED** (Scientifically impossible) |
| **2. Anomaly Detection** | Statistical sensor deviation from ambient background baseline. | **Supported** (Rainfall > 3$\sigma$ / River discharge spike) | **Supported** (Barometric pressure drop on AIS vessels) | **Supported** (Surface thermal spike on infrared) | **NOT SUPPORTED** (Precursor anomalies are unreliable) |
| **3. Event Detection** | Real-time physical confirmation that rupture/landfall/ignition occurred. | **Supported** (Stream gauge threshold tripped) | **Supported** (Coastal anemometer $V_{max}$ hit) | **Supported** (NASA VIIRS 375m hotspot detected) | **Supported** (USGS P/S-wave triangulation) |
| **4. Early Warning** | Immediate notification to downstream/downwind zones before secondary arrival. | **Supported** (Upstream dam release warning to downstream cities) | **Supported** (12h coastal storm surge advance warning) | **Supported** (Downwind smoke & wildfire spread warning) | **Supported** (10–60s Earthquake Early Warning via P-wave) |
| **5. Impact Forecast** | Projecting casualties, infrastructure cuts, and resource deficits. | **Supported** (DEM depth + OSM road network overlap) | **Supported** (Wind swath + structural fragility overlap) | **Supported** (Spread vector + WUI building overlap) | **Supported** (USGS ShakeMap MMI + building density) |

---

# PART 9 — POST-INCIDENT IMPACT ASSESSMENT ENGINE

When an incident is triggered or selected, the Impact Assessment Engine performs a rapid geospatial overlay across exposure datasets:

```
[INCIDENT SPATIAL FOOTPRINT] (Polygon / Radius / ShakeMap Isoseismal Contour)
                    │
                    ├──► OVERLAY [WorldPop / GHSL Population Raster]
                    │    └──► Total Population Exposed, Children/Elderly Vulnerability Count
                    │
                    ├──► OVERLAY [OpenStreetMap Highway Network]
                    │    └──► Submerged / Collapsed Road Segments, Isolated Suburbs
                    │
                    ├──► OVERLAY [OSM / HealthSites.io Critical Facilities]
                    │    └──► Hospitals, Trauma Centers, Fire Stations in Inundation Area
                    │
                    ├──► OVERLAY [Critical Power & Utility Grids]
                    │    └──► Substations Threatened, Water Treatment Plants at Risk
                    │
                    └──► OVERLAY [Live Tactical Intelligence Feeds]
                         └──► Stranded AIS Ships, Airspace Corridors, SAR Helicopters
```

### Primary Output Metrics:
1. **Affected Geographic Footprint:** Area in $\text{km}^2$ categorized by damage zone (e.g., MMI VIII severe vs. MMI VI moderate).
2. **Exposed Human Population:** Total residents within the impact polygon, stratified by vulnerable demographics.
3. **Critical Infrastructure Disruption:** Tally of impacted hospitals (categorized by bed capacity), power substations, and emergency services.
4. **Logistical Accessibility Matrix:** Count of severed road segments and identified viable arterial supply corridors.

---

# PART 10 — RESOURCE MODEL & LOGISTICAL OPTIMIZATION

Worldview models both real-world baseline facilities and dynamic response assets:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RESOURCE LOGISTICS ENGINE                       │
└────────────────────────────────────────────────────────────────────────┘
  │
  ├──► [FIXED INFRASTRUCTURE] (Real data via OpenStreetMap & Government Registries)
  │    • Hospitals & Trauma Centers (Bed count, ICU capacity, Helipad capability)
  │    • Fire & Rescue Stations
  │    • Designated Evacuation Shelters & Relief Camps
  │
  └──► [MOBILE RESPONSE UNITS] (Simulated for prototype; pluggable to 112/NDRF CAD feeds)
       • NDRF / SDRF Search & Rescue Teams (Personnel, Inflatable Boats, Extrication gear)
       • Advanced Life Support (ALS) Ambulances
       • Heavy Fire Tenders & Water Tankers
       • Supply Convoy Trucks (Rations, Clean Water, Generators)
```

```
[INCIDENT DEMAND] ──┐
                    ├─► [OPTIMAL ROUTING ENGINE (OSRM / Haversine)] ─► [DISPATCH ALLOCATION & ETA]
[RESOURCE SUPPLY] ──┘         (Avoids blocked/flooded road links)
```

### Real vs. Simulated Distinction:
* **Real Data:** Hospital locations, fire station locations, school/shelter locations, and permanent road networks (sourced directly from OpenStreetMap / Overpass API).
* **Simulated Data (Clearly Tagged in UI with `[SIMULATED FEED]`):** Real-time unit availability, dispatch status (AVAILABLE, EN ROUTE, ENGAGED), and current fuel/crew capacity.
* **Production Path:** In an actual National/State Emergency Operations Center (NEOC/SEOC), this simulated module is replaced with direct API integration to the emergency dispatch CAD (Computer Aided Dispatch) / 112 system.

---

# PART 11 — COMPARATIVE RESPONSE OPTIONS ENGINE

Rather than prescribing a single opaque decision, the system generates multiple tactical response options with transparent trade-offs for human incident commanders:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TACTICAL RESPONSE OPTIONS MATRIX                              │
├───────────┬─────────────────────┬─────────┬───────────────┬─────────────────────────────┤
│ OPTION    │ STRATEGY            │ ETA     │ RESOURCE COST │ PRIMARY TRADEOFF            │
├───────────┼─────────────────────┼─────────┼───────────────┼─────────────────────────────┤
│ OPTION A  │ Maximum Evacuation  │ 45 min  │ HIGH          │ Diverts all regional transit│
│           │ Outflow Corridor    │         │ (85% Units)   │ to one-way evacuation routes│
├───────────┼─────────────────────┼─────────┼───────────────┼─────────────────────────────┤
│ OPTION B  │ In-Place Vertical   │ 90 min  │ MODERATE      │ Avoids road congestion;     │
│           │ Sheltering          │         │ (45% Units)   │ high reliance on generator  │
│           │                     │         │               │ fuel logistics              │
├───────────┼─────────────────────┼─────────┼───────────────┼─────────────────────────────┤
│ OPTION C  │ Critical Asset      │ 30 min  │ FOCUSED       │ Protects major trauma hub   │
│           │ Defense Triage      │         │ (30% Units)   │ but delays secondary suburb │
│           │                     │         │               │ relief operations           │
└───────────┴─────────────────────┴─────────┴───────────────┴─────────────────────────────┘
```

### Key Operator Decision Parameters:
* **Resource Gap Visibility:** Visualizes shortages (e.g., Required: 25 Boats, Available: 14 $\rightarrow$ **Deficit: -11 Boats**).
* **Route Feasibility:** Calculates ETA based only on passable, unflooded roads using road network topology.
* **Expected Outcome:** Estimated percentage reduction in casualties and economic damage per option.

---

# PART 12 — AI ARCHITECTURE & SAFEGUARDS

```
[LIVE TELEMETRY & FUSION ENGINE]
               │
               ▼
[DETERMINISTIC RISK ENGINE] ──► Produces Verified Mathematical Snapshot
               │
               ▼
[STRUCTURED INCIDENT JSON] ──► Strict JSON Schema with Concrete Ground Truth
               │
               ▼
[GEMINI PRO REASONING AGENT]
               │
               ├─► Synthesizes Executive Intelligence Dossier
               ├─► Formulates Operator Briefing: "Why is this critical?"
               ├─► Summarizes Sensor Anomalies & Telemetry Shifts
               └─► Explains Response Option Tradeoffs
               │
               ▼
[HALLUCINATION SAFEGUARD LAYER] (Validates that coordinates/numbers match raw JSON)
               │
               ▼
[TACTICAL OPERATOR HUD]
```

### Critical Rules: Where Gemini is Used vs. Prohibited

| Capability | Gemini Role | System Ground Truth | Rationale |
|---|---|---|---|
| **Risk Score Calculation** | ❌ **PROHIBITED** | ✅ Deterministic Math Engine | LLMs are non-deterministic and hallucinate quantitative scores. |
| **Epicenter / Landfall Coordinates** | ❌ **PROHIBITED** | ✅ Sensor Ingestion (USGS / IMD) | LLMs cannot triangulate spatial coordinates. |
| **Resource Gap Math** | ❌ **PROHIBITED** | ✅ Deterministic Subtraction | Math must be verifiable in command audits. |
| **Executive Situation Summary** | ✅ **ALLOWED (Primary)** | Input JSON Snapshot | Gemini excels at synthesizing multi-layer data into military-grade briefs. |
| **Operator Explanation ("Why?")** | ✅ **ALLOWED (Primary)** | Rule Engine Attribution | Explaining causal relationships in clear natural language. |
| **Response Option Comparison** | ✅ **ALLOWED (Primary)** | Response Engine Options | Articulating qualitative trade-offs for human commanders. |

### Hallucination Safeguards:
1. **Strict Input Templating:** Gemini is provided with structured, pre-computed JSON snapshots containing verified counts, coordinates, and physical units.
2. **Server-Side Fallback Generator:** If Gemini times out, hits rate limits, or outputs malformed text, `server/index.js` automatically produces a deterministic, procedural tactical dossier based on the actual telemetry numbers.
3. **Double Verification:** The UI cross-checks numbers in Gemini’s generated text against the underlying telemetry state.

---

# PART 13 — UI / UX ARCHITECTURE: WORLD MODE VS. INCIDENT MODE

The interface maintains Worldview’s dark, tactical operations-center aesthetic, with the **3D Cesium Globe remaining the primary visual interface at all times**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    WORLDVIEW COMMAND UI                                     │
├─────────────────────────┬─────────────────────────────────────────┬─────────────────────────┤
│ LEFT PANEL:             │ CENTER: 3D CESIUM GLOBE                 │ RIGHT PANEL:            │
│ DATA & LAYER CONTROL    │                                         │ CONTEXTUAL INTELLIGENCE │
│                         │ • Circular Tactical Viewport            │                         │
│ • Region Selector       │ • 3D Terrain & Satellite Imagery        │ [NOTHING SELECTED]      │
│ • Data Layer Toggles    │ • Batched Point Primitives              │  └─ Global Telemetry    │
│ • Live Data Stream Feed │ • Directional Billboards                │ [OBJECT SELECTED]       │
│ • Incident Mode Filter  │ • Impact Polygons & Danger Cones        │  └─ Object HUD Card     │
│                         │ • GLSL Shader Presets (CRT/NVG/FLIR)    │ [INCIDENT SELECTED]     │
│                         │                                         │  └─ Incident Dossier &  │
│                         │                                         │     Response Options    │
├─────────────────────────┴─────────────────────────────────────────┴─────────────────────────┤
│ BOTTOM DOCK: TACTICAL TELEMETRY HUD // CRISIS OVERLAY TRIGGER // STYLE PRESETS             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### State 1: WORLD MODE (Global Monitoring)
* **Visual State:** Broad global camera viewpoint; all active live feeds (flights, satellites, ships, earthquakes, weather) visible across the 3D globe.
* **Left Panel:** Complete layer toggles, global region selector, and chronological multi-sensor live stream feed.
* **Right Panel:** Global system telemetry, active sensor status, and global seismic watch list.
* **Objective:** Continuous multi-domain surveillance and anomaly scanning.

### State 2: INCIDENT MODE (Tactical Response)
* **Trigger:** Initiated when the operator clicks an incident card or when an automatic severe threshold ($M_w \ge 6.0$, Extreme Flood, Cat 3+ Cyclone) is tripped.
* **Camera Behavior:** Smooth camera flight (2.5s cubic ease) auto-focusing on the disaster centroid/epicenter at appropriate altitude.
* **Globe Layer Adaptation:**
  * The disaster impact polygon / Shakemap / storm surge cone becomes visually primary (pulsing neon amber/red).
  * **Relevant Live Feeds Remain Visible:** (e.g., Flood: SAR satellites, emergency helicopters, nearby traffic, hospitals).
  * **Irrelevant Live Feeds are De-emphasized:** High-altitude transcontinental flights and distant commercial ships are dimmed to 15% opacity rather than abruptly removed.
* **Right Panel Adaptation:** Transforms into the **Incident Intelligence & Decision Dossier**:
  1. Incident Severity, Confidence & Real-Time Physical Metrics.
  2. Mathematical Risk Breakdown ("Why is this Critical?").
  3. Impact Assessment (Population exposed, threatened hospitals, severed roads).
  4. Resource Optimization & Resource Gap readout.
  5. Interactive Response Option Cards (Option A vs. Option B vs. Option C).
  6. AI Tactical Synthesis Briefing.
* **Return Mechanism:** Single-click `[EXIT INCIDENT // RETURN TO WORLD MONITORING]` button returns camera to global overview and restores default layer opacities.

### Feed Relevance Matrix:

| Incident Type | Weather | Satellites | Aircraft | Ships | Earthquakes | Road Traffic |
|---|---|---|---|---|---|---|
| **Flood** | **HIGH (Rain)** | **HIGH (SAR)** | **MED (SAR Helis)** | **LOW** | **NONE** | **HIGH (Cuts)** |
| **Cyclone** | **CRITICAL** | **HIGH (Optical)** | **HIGH (Airspace)** | **HIGH (Vessels)**| **NONE** | **HIGH (Evac)** |
| **Wildfire** | **HIGH (Wind)** | **CRITICAL (FIRMS)**| **MED (Airdrops)** | **NONE** | **NONE** | **HIGH (Smoke)** |
| **Earthquake** | **LOW** | **MED (Damage)** | **MED (Relief)** | **MED (Tsunami)** | **CRITICAL** | **CRITICAL** |

---

# PART 14 — MODULAR ARCHITECTURAL PRINCIPLES

To avoid a monolithic codebase, the architecture strictly separates concerns into clean, unidirectional pipelines:

```
[External Data Providers]
          │
          ▼
┌──────────────────┐
│ Provider Adapter │ ◄── Ingests raw format & normalizes to Canonical Event
└─────────┬────────┘
          ▼
┌──────────────────┐
│  Fusion Engine   │ ◄── Spatial/temporal alignment & cross-feed correlation
└─────────┬────────┘
          ▼
┌──────────────────┐
│ Incident Engine  │ ◄── Evaluates anomaly thresholds & manages Incident lifecycle
└─────────┬────────┘
          ▼
┌──────────────────┐
│   Risk Engine    │ ◄── Computes deterministic math risk & attribution breakdown
└─────────┬────────┘
          ▼
┌──────────────────┐
│ Response Engine  │ ◄── Solves resource allocation, gap analysis & routing
└─────────┬────────┘
          ▼
┌──────────────────┐
│ AI Reasoning Lyr │ ◄── Gemini Pro translates structured snapshot to operator brief
└─────────┬────────┘
          ▼
┌──────────────────┐
│  Presentation UI │ ◄── Cesium 3D Globe + Tactical HUD Panels
└──────────────────┘
```

---

# PART 15 — DATA PROVIDER ABSTRACTION PATTERN

The system abstracts data sources behind unified interfaces so providers can be swapped, mocked, or combined without altering core application logic:

```typescript
// Core Provider Interface Contract
interface DataProvider<T> {
  id: string;
  name: string;
  category: 'HAZARD' | 'WEATHER' | 'EXPOSURE' | 'TELEMETRY';
  fetchData(bounds?: GeoBoundingBox): Promise<T[]>;
  normalize(raw: any): NormalizedEvent[];
}

// Example Implementations
class USGSSeismicProvider implements DataProvider<SeismicEvent> { ... }
class EMSCSeismicProvider implements DataProvider<SeismicEvent> { ... }

class OpenMeteoWeatherProvider implements DataProvider<WeatherData> { ... }
class IMDWeatherProvider implements DataProvider<WeatherData> { ... }
```

### Key Advantages:
* **Fault Tolerance:** If OpenSky is throttled, the adapter seamlessly falls back to ADS-B Exchange or static caches without breaking the UI.
* **Multi-Region Portability:** Ready for international expansion or localized regional authorities (e.g., swapping USGS for IMD/NDMA in India).
* **Testing:** Enables instant switching to mock disaster simulation feeds for end-to-end testing without waiting for a real-world disaster to occur.

---

# PART 16 — WHAT NOT TO BUILD (ANTI-PATTERNS & VANITY FEATURES)

To maximize competition performance and engineering depth, we explicitly define features that will **NOT** be built:

| Feature / Anti-Pattern | Why It Should NOT Be Built | Recommended Alternative |
|---|---|---|
| **Generic Free-Text AI Chatbot** | Unstructured conversational chatbots fail under pressure, hallucinate fake casualty numbers, and look like a superficial wrapper. | **Structured Executive Intelligence Dossier** with strict schema, deterministic attribution, and actionable response comparison cards. |
| **Overwhelming "Dashboard of 50 Cards"** | Destroys the visual identity and makes spatial comprehension impossible. | **Globe-First Spatial Interface** with context-sensitive sidebars and progressive disclosure. |
| **Unsubstantiated Earthquake Prediction** | Claiming to predict earthquake exact time/location is scientifically fraudulent and will be penalized by judges. | **Rapid Post-Event ShakeMap & Exposure Calculation** with Earthquake Early Warning (EEW) timeline awareness. |
| **Dozens of Random, Uncurated APIs** | Creates network instability, random breakages during demos, and high latency. | **5 High-Reliability Core Disaster Pipelines** with rigorous fallback mechanisms. |
| **Static Non-Interactive Hazard Polygons** | Flat overlays without impact analysis provide zero decision-support value. | **Interactive Incident Pipeline:** Hazard $\rightarrow$ Population Exposed $\rightarrow$ Hospital Disruptions $\rightarrow$ Resource Allocation. |

---

# PART 17 — SIH 2026 COMPETITIVE STRATEGY & RISK MATRIX

### Competitiveness Evaluation:

```
┌────────────────────────────────────────────────────────────────────────┐
│              SIH 2026 BENCHMARK AUDIT (SCORE: 9.4 / 10)                │
├──────────────────────────┬───────┬─────────────────────────────────────┤
│ CRITERIA                 │ SCORE │ EVALUATION                          │
├──────────────────────────┼───────┼─────────────────────────────────────┤
│ Visual Impact & Immersion│ 10/10 │ Palantir-style 3D globe is elite    │
│ Technical Sophistication │ 9/10  │ Cesium + Workers + Fusion + Shaders │
│ Decision-Support Utility │ 9/10  │ Multi-option response + Math Risk   │
│ Feasibility & Stability  │ 9.5/10│ Offline fallbacks + Local caches    │
│ Scientific Credibility   │ 9.5/10│ Strict UNDRR/INFORM math alignment  │
└──────────────────────────┴───────┴─────────────────────────────────────┘
```

### Strong Differentiators (Why Worldview Wins):
1. **Globe-First Operations Architecture:** While competing teams present standard Bootstrap/Tailwind web forms full of static charts, Worldview delivers an immersive 3D tactical command environment running at 60 FPS.
2. **Deterministic Math + AI Reasoning Separation:** Judges consistently penalize "AI-only" projects for hallucination. Worldview mathematically calculates risk and uses Gemini exclusively for synthesis and explanation.
3. **Operational Relevance of Live Feeds:** Demonstrating how commercial aircraft, maritime ships, and satellites serve as active disaster intelligence assets (rather than decorative background noise) showcases genuine system design depth.
4. **Resilient Offline Architecture:** The dual-proxy, LRU cache, and local JSON/TLE snapshot fallback ensures the live demo **never crashes**, even if venue Wi-Fi fails completely.

### Risks and Mitigation:
* **Demo Wi-Fi Failure Risk:** *Mitigated.* All data hooks include pre-cached realistic disaster datasets (`/data/active-*.json`) that activate seamlessly if external network requests fail.
* **Gemini Quota Exhaustion Risk:** *Mitigated.* Server-side dual API keys + procedural tactical fallback report generator guarantees continuous operation even if Google AI quotas are depleted.

---

# PART 18 — MASTER SYNTHESIS & FINAL STRATEGIC DELIVERABLE

### 18.1 Master System Architecture Summary

```
WORLDVIEW SIH 2026 DISASTER PLATFORM
├── 1. DATA FABRIC: USGS (Quakes) + NASA FIRMS (Fires) + Open-Meteo (Rain/Storms) + AISStream (Ships) + OpenSky (Planes) + CelesTrak (Satellites) + OSM (Infrastructure)
├── 2. FUSION & ANOMALY: Web Worker Ingestion ──► GeoSpatial Indexing ──► Multi-Feed Cross-Correlation ──► Anomaly Trigger
├── 3. DETERMINISTIC RISK ENGINE: Risk = (Hazard × Exposure × Vulnerability / Capacity)^(1/3) × Confidence
├── 4. CANONICAL INCIDENT PIPELINE: Generates Rich Incident Record (Spatial, Hazard, Exposure, Resources, Response)
├── 5. DECISION ENGINE: Generates Option A / Option B / Option C with ETA, Cost, and Passable Route Optimization
├── 6. REASONING LAYER: Gemini Pro parses Incident Snapshot ──► Executive Dossier + "Why?" Attribution
└── 7. VISUAL HUD: CesiumJS 3D Globe + WebGL2 Post-Process Shaders + World Mode ↔ Incident Mode Transition
```

---

### 18.2 Implementation Priority Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              IMPLEMENTATION ROADMAP                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [P0 — ABSOLUTELY ESSENTIAL CORE (Must be built first)]                                  │
│  1. Implement Canonical Incident State in WorldViewContext (Active incident management) │
│  2. Add NASA FIRMS (Wildfires) & GDACS/Open-Meteo Flood Feeds with fallback datasets    │
│  3. Build Deterministic Mathematical Risk Engine with Explainability Point Attribution   │
│  4. Implement World Mode ↔ Incident Mode UI transitions and camera focus mechanics     │
│  5. Build Right-Panel Incident Intelligence & Response Option comparison cards          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [P1 — MAJOR DIFFERENTIATORS (Elevates project to winning tier)]                         │
│  1. OpenStreetMap Infrastructure Overpass integration (Hospitals, Shelters, Bridges)    │
│  2. Visual Feed Relevance System (Dimming irrelevant layers during active incidents)   │
│  3. Disaster Impact Polygons (3D Inundation Zones, ShakeMap Contours, Wind Swaths)     │
│  4. Simulated Emergency Resource Dispatcher & Resource Gap Calculator                   │
│  5. Upgrade Gemini Prompting to consume structured Incident JSON dossiers               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [P2 — ENHANCEMENT POLISH (If time permits)]                                             │
│  1. Historical Disaster Replay Slider (Scrubbing time through past major disasters)     │
│  2. Evacuation Route Polyline computation on Cesium globe (Passable road routing)       │
│  3. Additional GLSL Post-Process Tactical Modes (Thermal FLIR Inversion, Flood Mask)    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 18.3 The Definitive SIH Recommendation
> **"If we had limited time before SIH, what exact system should we build?"**
>
> We should build a **4-Disaster Incident-Driven Intelligence Engine** on top of the existing Cesium globe:
> 1. **Preserve the visual identity and current feeds** (flights, satellites, ships, quakes) as the global operational picture (**World Mode**).
> 2. **Add NASA FIRMS active fires and Open-Meteo flood/cyclone hazard feeds** with pre-cached disaster scenarios.
> 3. **Implement the World Mode $\rightarrow$ Incident Mode transition:** Clicking any active disaster smoothly flies the camera to the epicenter, draws the pulsing 3D impact zone, highlights relevant feeds, and opens the **Incident Intelligence Dossier** in the right panel.
> 4. **Display mathematical risk point-attribution** alongside **comparative response option cards (Option A vs. Option B)**.
> 5. **Use Gemini Pro to deliver executive military-style crisis dossiers** explaining the situation, why it occurred, and what trade-offs commanders must weigh.

---

### Audit Phase Status: COMPLETE.
*Zero modifications have been made to the repository code, UI, or dependencies. The architecture is mapped, verified against the actual repository implementation, and ready for review before Phase 2 implementation begins.*
