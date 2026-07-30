# Worldview

Worldview is a real-time 3D geospatial intelligence and situational-awareness platform for visualizing global human activity, natural phenomena, orbital assets, and live maritime operations. Built with React 19, Vite 7, CesiumJS, and Google Gemini Pro, it presents a cinematic operational command interface inspired by modern defense intelligence dashboards.

![Worldview Circular Viewport](https://img.shields.io/badge/Interface-Palantir--Style-cyan?style=for-the-badge)
![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-7.3-purple?style=for-the-badge&logo=vite)
![CesiumJS](https://img.shields.io/badge/CesiumJS-1.139-green?style=for-the-badge)

---

## Overview

Worldview aggregates multiple real-time and near-real-time global datasets into a unified 3D globe visualization. Designed for performance and visual clarity, the application uses high-throughput WebGL primitive rendering to display hundreds of active flights, satellites, earthquakes, and vessels without framerate degradation.

An integrated AI Crisis Intelligence agent powered by Google Gemini continuously analyzes live global data snapshots to deliver concise situational assessments and threat priority ratings.

---

## Key Features

- **3D Globe Visualization**: Interactive CesiumJS globe with smooth camera transitions, custom GLSL shader post-processing stages (CRT, Night Vision, Thermal FLIR), and HUD overlays.
- **Google Photorealistic 3D Tiles**: High-resolution 3D building and terrain mesh rendering for urban detail.
- **Live Commercial Flights**: Real-time position tracking of airborne commercial aircraft powered by OpenSky Network state vectors.
- **Orbital Satellites**: Live propagation of active satellite orbits using CelesTrak TLE data processed via satellite.js in background Web Workers.
- **Seismic Activity**: Live earthquake feeds provided by the USGS GeoJSON summary, highlighted with magnitude-scaled pulse indicators.
- **Maritime Vessel Tracking**: Real-time AIS stream position reports and static data for cargo, tankers, and military ops vessels via AISStream WebSocket integration.
- **Weather & NEXRAD**: Precipitation and weather overlays.
- **AI Crisis Intelligence Agent**: Gemini Pro integration providing under-40-word tactical situation reports with automatic priority classification (HIGH / MED / LOW).

---

## Architecture & Security Design

Worldview uses a decoupled client-server architecture to isolate sensitive API credentials and protect backend endpoints against abuse and quota exhaustion:

```
[ Frontend: React 19 / Vite / CesiumJS ]
               │
               ├──────► Google Photorealistic 3D Tiles (Direct Client WebGL with Domain Restrictions)
               │
               ▼
[ Express API Proxy Server (Port 3001) ]
               │
               ├── Rate Limiter (Per-IP limits: 10 req/15min AI, 60 req/min general)
               ├── Global Concurrency Lock (Max 2 active Gemini calls)
               ├── Global Usage Ceiling (Daily request limit counter)
               ├── Normalized Parameter Validation & Bounded LRU/TTL Cache
               │
               ├──► Google Gemini Pro API (Server-Side Secrets: GEMINI_API_KEY_1 / 2)
               ├──► AISStream WebSocket (Server-Side Secret: AISSTREAM_API_KEY)
               ├──► OpenSky Network API (Cached 10s to prevent IP bans)
               ├──► CelesTrak TLE Feed (Cached 1h)
               └──► USGS Earthquakes Feed (Cached 5m)
```

---

## Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19, Vite 7 | Fast, modern client SPA runtime |
| **3D Graphics Engine** | CesiumJS (Raw API) | High-performance WebGL globe & primitive collections |
| **Styling & CSS** | Tailwind CSS v4, Vanilla CSS | Custom HUD styling, scanlines, vignettes |
| **Backend Server** | Node.js, Express, `ws` | API proxy, rate limiting, AISStream consumer, cache |
| **Orbital Propagation** | `satellite.js` | SGP4 orbital propagation in Web Workers |
| **AI Intelligence** | Google Gemini 2.5 Flash | Real-time crisis assessment & priority tagging |

---

## Data Sources & Attribution

Worldview integrates data from public intelligence feeds and external API providers:

| Data Feed | Provider / Source | Update Mechanism | Access Tier / Requirements |
| :--- | :--- | :--- | :--- |
| **Commercial Flights** | [OpenSky Network](https://opensky-network.org/) | Polled state vectors (10s cache) | Public Data / Open API |
| **Satellites** | [CelesTrak](https://celestrak.org/) | TLE orbital element GP feed (1h cache) | Public Data / Open Access |
| **Earthquakes** | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) | GeoJSON summary feed (5m cache) | Public Domain / Open Access |
| **Maritime Vessels** | [AISStream](https://aisstream.io/) | WebSocket AIS position stream | API Key Required (Server-Side) |
| **Crisis Analysis** | [Google Gemini Pro](https://ai.google.dev/) | REST API generation (30s cache) | API Key Required (Server-Side) |
| **3D Photorealistic Tiles** | [Google Maps Platform](https://developers.google.com/maps) | Direct WebGL 3D Tiles API | API Key Required (Client-Side) |
| **Weather** | [Open-Meteo](https://open-meteo.com/) / NOAA | Forecast REST API & NEXRAD WMS | Public Data / CC-BY 4.0 |

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/worldview.git
   cd worldview
   ```

2. Install dependencies:
   ```bash
   cd worldview
   npm install
   ```

---

## Environment Variables Setup

Copy `.env.example` to `.env` inside the `worldview/` directory:

```bash
cp .env.example .env
```

Populate `.env` with your API credentials:

```env
# Client-Visible (Restricted by HTTP Referrer in Google Cloud Console)
VITE_GOOGLE_MAPS_KEY=your_google_maps_3d_tiles_key

# Server-Only Secrets (Never exposed to browser)
GEMINI_API_KEY_1=your_primary_gemini_api_key
GEMINI_API_KEY_2=your_optional_fallback_gemini_api_key
AISSTREAM_API_KEY=your_aisstream_api_key

PORT=3001
GEMINI_DAILY_LIMIT=500
```

---

## Running Locally

To start both the Express backend API proxy server and the Vite frontend dev server:

1. In terminal 1, start the backend API server:
   ```bash
   npm run server
   ```

2. In terminal 2, start the Vite development server:
   ```bash
   npm run dev
   ```

Open your browser at `http://localhost:5173`. The Vite dev server automatically proxies `/api/*` requests to the Express server running on `http://localhost:3001`.

---

## Production Build

To build and run the production application:

```bash
npm run build
npm run start
```

The production server will build static assets to `dist/` and serve both the SPA frontend and `/api/*` proxy endpoints from `http://localhost:3001`.

---

## Project Structure

```
worldview/
├── server/
│   ├── index.js                # Express API proxy server, AISStream WS worker & rate limiters
│   └── store.js                # Decoupled bounded LRU cache with TTL support
├── src/
│   ├── components/             # React UI HUD & 3D Globe components
│   │   ├── GlobeViewer.jsx     # CesiumJS core rendering engine & visual shaders
│   │   ├── DataLayersPanel.jsx # Layer toggle controls
│   │   ├── GeminiPanel.jsx     # Crisis intelligence UI panel
│   │   └── VisualControlsPanel.jsx # Presets and HUD readouts
│   ├── hooks/                  # Custom data hooks fetching via /api proxy
│   │   ├── useFlights.js       # Flights hook via /api/flights
│   │   ├── useSatellites.js    # Satellites hook via /api/satellites
│   │   ├── useShips.js         # Vessels hook via /api/ships
│   │   ├── useEarthquakes.js   # Earthquakes hook via /api/earthquakes
│   │   └── useGemini.js        # Gemini intelligence hook via /api/gemini
│   ├── workers/                # Web Workers for satellite orbit propagation
│   └── worldview.css           # Viewport styles, scanlines, vignettes
├── public/                     # Static assets & fallback datasets
├── .env.example                # Template for environment variables
└── vite.config.js              # Vite configuration with /api proxy
```

---

## Security & API Abuse Protections

- **Secret Isolation**: `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, and `AISSTREAM_API_KEY` are read strictly server-side by `server/index.js` and never bundled into client JavaScript.
- **Client Key Domain Restrictions**: `VITE_GOOGLE_MAPS_KEY` is restricted by domain in Google Cloud Console.
- **Rate Limits**: Per-IP rate limiting enforces 10 requests / 15 minutes on AI endpoints and 60 requests / minute on data endpoints.
- **Global Usage Caps**: Daily hard request limit counter caps Gemini AI calls across all clients.
- **Upstream Timeouts**: All upstream API calls enforce an 8-second `AbortSignal` timeout to prevent hanging worker sockets.
- **Bounded In-Memory Caching**: Responses are cached in a bounded LRU/TTL store to prevent unbounded memory growth and reduce upstream API overhead.

---

## Known Limitations

- **OpenSky Network Rate Limits**: OpenSky anonymous state vectors are capped by OpenSky to 10-second update intervals.
- **AISStream Coverage**: AIS vessel tracking coverage depends on terrestrial receiver density and satellite AIS availability in specific sea zones.
- **In-Memory Store Scope**: The default backend cache and rate limiters operate in-memory for single-instance deployments. For horizontal multi-instance scaling, swap `store.js` with a Redis adapter.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before submitting pull requests.

---

## License

This repository does not currently include an open-source license. All rights reserved by the author. Prior to public redistribution or commercial use, an explicit license (e.g., MIT or Apache 2.0) should be added.
