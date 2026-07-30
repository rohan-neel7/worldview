# WORLDVIEW — Complete Project Context for AI Assistants

> **Read this entire file before making any changes to this codebase.**
> This document describes every architectural decision, file, convention, and constraint in the WorldView project. Violating any rule listed here will break the application or degrade performance.

---

## 1. What Is WorldView?

WorldView is a **real-time 3D global intelligence dashboard** — a cinematic, Palantir-style operational command interface built for **FantomCode 2026** (national 24-hour hackathon at RVITM Bengaluru, April 10–11 2026).

It renders a CesiumJS 3D Earth globe inside a circular viewport with 7 live data overlays, 6 visual post-processing presets, HUD overlays, and a Google Gemini-powered crisis intelligence agent. The visual reference is Bilawal Sidhu's WorldView project — the aesthetic is "Palantir and Google Earth had a baby."

**Demo flow:** Zoom from global view (flights + satellites) → into Bengaluru city (photorealistic 3D tiles + traffic + CCTV + crisis AI output).

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.x |
| Build | Vite | 7.x |
| 3D Globe | CesiumJS | 1.139.x |
| Globe React bindings | Resium | 1.19.x (installed but not currently used — raw Cesium API used directly) |
| Satellite math | satellite.js | 6.x |
| AI agent | @google/generative-ai (Gemini Pro) | latest |
| CSS framework | Tailwind CSS v4 | 4.x (via @tailwindcss/vite plugin) |
| Cesium Vite plugin | vite-plugin-cesium | latest |

### Important: Resium is installed but NOT used
The globe is built using the **raw CesiumJS API** with `new Cesium.Viewer()` inside a `useRef`. This is intentional — Resium's declarative wrappers would violate Rule 1 (PointPrimitiveCollection) and Rule 2 (in-place Map updates). Do **not** refactor to use Resium's `<Viewer>`, `<Entity>`, etc.

---

## 3. The 10 Architecture Rules — NEVER VIOLATE

These rules exist for performance and consistency. Every function, component, and hook in this codebase follows them. If a change would violate any rule, **do not make that change**.

| # | Rule | Why |
|---|------|-----|
| 1 | Use `PointPrimitiveCollection` for flights and satellites — **never** individual `Entity` objects | Entities have per-frame overhead. PointPrimitiveCollection is GPU-batched. At 500+ objects, entities cause frame drops. |
| 2 | Update positions **in-place** using `Map` lookups — **never** recreate/clear collections on data refresh | Clearing and rebuilding causes GC spikes and visual flicker. Map-based diffing is O(n) and smooth. |
| 3 | Cesium `Viewer` instance stored in `useRef` — **never** `useState` | useState would cause React re-renders on every state change, which would destroy and recreate the Cesium viewer. |
| 4 | All shared state lives in `WorldViewContext` (React Context) | Single source of truth. No prop drilling, no scattered useState across siblings. |
| 5 | Data flows **DOWN** via props, events flow **UP** via callbacks | Standard React unidirectional data flow. Hooks produce data → App passes to GlobeViewer as props. |
| 6 | Every async operation wrapped in `try/catch` | API calls can fail (CORS, rate limits, network). Silent failures prevent UI crashes. |
| 7 | Hard caps: flights **500**, satellites **200**, earthquakes **100** | More objects = linear GPU cost. These caps keep frame rate above 30fps on mid-range hardware. |
| 8 | All feed intervals **staggered** — never fire simultaneously | Simultaneous fetches cause network contention and CPU spikes. Stagger offsets: flights 0s, military +1s, satellites +3s, traffic +5s, earthquakes +7s, weather +12s, Gemini +15s. |
| 9 | Modern GLSL syntax: `in vec2 v_textureCoordinates` and `out_FragColor` | CesiumJS 1.139+ uses WebGL2/GLSL 300es. Old `varying`/`gl_FragColor` syntax will cause shader compilation errors. |
| 10 | **Never** use `localStorage` or `sessionStorage` | This is a live operational dashboard. Persisting state creates stale data bugs and security concerns. All state is ephemeral. |

---

## 4. Directory Structure

```
worldview/
├── index.html                          # Entry HTML — Share Tech Mono font, black bg
├── vite.config.js                      # Vite + CesiumJS + Tailwind plugins
├── package.json                        # Dependencies
├── .env                                # (user-created) VITE_GEMINI_KEY_1, VITE_GEMINI_KEY_2
│
├── src/
│   ├── main.jsx                        # React root mount, imports CSS
│   ├── App.jsx                         # Top-level composition — hooks + components
│   ├── WorldViewContext.jsx            # React Context provider (all shared state)
│   ├── index.css                       # Tailwind v4 import + CSS custom properties
│   ├── worldview.css                   # All cinematic visual effects
│   │
│   ├── components/
│   │   ├── GlobeViewer.jsx             # Cesium viewer + all rendering layers
│   │   ├── HUD.jsx                     # HUD overlay container
│   │   ├── ClassificationBar.jsx       # TOP SECRET banners + live timestamp
│   │   ├── RecordingIndicator.jsx      # Blinking REC dot
│   │   ├── CoordinateDisplay.jsx       # LAT/LON/ALT readout from camera
│   │   ├── DataLayersPanel.jsx         # Left panel — 7 data layer toggles
│   │   ├── LayerToggle.jsx             # Individual toggle row component
│   │   ├── StylePresetsPanel.jsx       # Right panel — 6 visual presets
│   │   ├── LocationsPanel.jsx          # Right panel — fly-to locations
│   │   ├── VisualControlsPanel.jsx     # Left panel — system status readout
│   │   └── GeminiPanel.jsx             # Bottom-right — crisis intelligence
│   │
│   └── hooks/
│       ├── useFlights.js               # OpenSky REST, 10s, cap 500
│       ├── useMilitaryFlights.js       # adsb.lol/api/0/mil, 30s
│       ├── useEarthquakes.js           # USGS GeoJSON, 5min, cap 100
│       ├── useSatellites.js            # CelesTrak TLE + satellite.js, 30s, cap 200
│       ├── useTraffic.js               # Overpass API (Bengaluru), 2min
│       ├── useWeather.js               # NOAA NEXRAD, 5min
│       ├── useCCTV.js                  # OSM surveillance nodes, static
│       └── useGemini.js                # Gemini Pro, 60s + manual, dual-key
```

---

## 5. Component Architecture

### 5.1 Data Flow Diagram

```
WorldViewProvider (Context)
  └─ WorldViewApp
       ├─ useFlights(enabled, 0ms)           ──┐
       ├─ useMilitaryFlights(enabled, 1000ms) ──┤
       ├─ useSatellites(enabled, 3000ms)      ──┤
       ├─ useEarthquakes(enabled, 7000ms)     ──┤  data arrays
       ├─ useTraffic(enabled, 5000ms)         ──┤  flow DOWN
       ├─ useWeather(enabled, 12000ms)        ──┤  as props
       ├─ useCCTV(enabled)                    ──┤
       ├─ useGemini(true, snapshot, 15000ms)  ──┘
       │
       ├─ GlobeViewer ← receives data arrays as props
       │   ├─ PointPrimitiveCollection (flights)     ← Map<id, point>
       │   ├─ PointPrimitiveCollection (satellites)  ← Map<id, point>
       │   ├─ BillboardCollection (CCTV)             ← Map<id, billboard>
       │   ├─ PolylineCollection (traffic)           ← Map<id, polyline>
       │   ├─ Entities (earthquakes)                 ← cleared + rebuilt (low count OK)
       │   └─ PostProcessStage (active visual preset GLSL shader)
       │
       ├─ HUD
       │   ├─ ClassificationBar (top)
       │   ├─ ClassificationBar (bottom)
       │   ├─ RecordingIndicator
       │   └─ CoordinateDisplay ← reads cameraPosition from context
       │
       ├─ DataLayersPanel ← reads/writes activeLayers via context
       │   └─ LayerToggle × 7
       │
       ├─ StylePresetsPanel ← reads/writes activePreset via context
       ├─ LocationsPanel
       ├─ VisualControlsPanel ← reads counts from context
       └─ GeminiPanel ← reads geminiOutput from context
```

### 5.2 How GlobeViewer Renders Data

Each data type has its own rendering strategy. **This is critical — do not change rendering strategies.**

| Data Type | Cesium Primitive | Update Strategy | Why |
|-----------|-----------------|-----------------|-----|
| Flights | `PointPrimitiveCollection` | Map lookup → update `point.position` in-place, add/remove diff | 500 objects — needs GPU batching |
| Satellites | `PointPrimitiveCollection` | Same Map strategy as flights | 200 objects — same reason |
| CCTV | `BillboardCollection` | Map lookup, load once (static data) | Canvas-drawn icons, one-time load |
| Traffic | `PolylineCollection` | Clear + rebuild on update (roads change rarely) | Road geometry is static per fetch |
| Earthquakes | `Entity` (viewer.entities) | `removeAll()` + rebuild | Only ≤100 objects, entities OK at this count |

### 5.3 GLSL Visual Presets

All shaders live in `GlobeViewer.jsx` in the `PRESET_SHADERS` object. They are applied as `PostProcessStage` instances.

| Preset | Effect |
|--------|--------|
| NORMAL | No post-processing (shader removed) |
| CRT | Warm desaturation + 0.85 brightness reduction |
| NVG | Full green channel conversion (night vision) |
| FLIR | High contrast green with slight cyan tint |
| NOIR | Full grayscale desaturation |
| SNOW | Blue tint + 1.15 brightness boost |

**GLSL syntax rule:** All shaders use `in vec2 v_textureCoordinates` and `out vec4 out_FragColor` (not `varying`/`gl_FragColor`).

---

## 6. WorldViewContext — State Shape

```javascript
{
  // Layer toggles — which data feeds are active
  activeLayers: {
    flights: boolean,        // default: true
    militaryFlights: boolean, // default: false
    earthquakes: boolean,     // default: true
    satellites: boolean,      // default: true
    traffic: boolean,         // default: false
    weather: boolean,         // default: false
    cctv: boolean,            // default: false
  },
  toggleLayer: (layerId: string) => void,
  LAYER_META: { [id]: { label, source, interval } },

  // Visual preset
  activePreset: 'NORMAL' | 'CRT' | 'NVG' | 'FLIR' | 'NOIR' | 'SNOW',
  setActivePreset: (preset: string) => void,
  PRESETS: string[],

  // Live data counts (written by App.jsx from hook data)
  flightCount: number,
  satelliteCount: number,
  earthquakeCount: number,

  // Summaries
  weatherSummary: string,      // 'NEXRAD ACTIVE' | 'NO DATA'
  trafficLevel: string,        // 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN'

  // Gemini output
  geminiOutput: string | null,

  // Camera position (written by GlobeViewer on camera move)
  cameraPosition: { lat: number, lon: number, alt: number },
}
```

---

## 7. Data Hook Patterns

Every hook follows this exact pattern:

```javascript
export default function useXxx(enabled, staggerMs = N) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      // fetch, parse, cap, setData
    } catch (err) {           // Rule 6
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setData([]); clearInterval; return; }
    const timeout = setTimeout(() => {     // Rule 8: stagger
      fetchData();
      intervalRef.current = setInterval(fetchData, REFRESH_MS);
    }, staggerMs);
    return () => { clearTimeout(timeout); clearInterval(intervalRef.current); };
  }, [enabled, staggerMs, fetchData]);

  return { data, loading, error, refresh: fetchData };
}
```

**Key conventions:**
- `enabled` parameter controls whether the hook fetches (tied to `activeLayers.xxx`)
- `staggerMs` delays the first fetch to prevent network contention (Rule 8)
- All data is capped with `.slice(0, CAP)` before setting state (Rule 7)
- Cleanup always clears both `setTimeout` and `setInterval`

### Hook-Specific Details

| Hook | API Endpoint | Refresh | Cap | Stagger | Notes |
|------|-------------|---------|-----|---------|-------|
| `useFlights` | `opensky-network.org/api/states/all` | 10s | 500 | 0ms | Filters `onGround: true` |
| `useMilitaryFlights` | `api.adsb.lol/api/0/mil` | 30s | — | 1000ms | May need CORS proxy |
| `useEarthquakes` | `earthquake.usgs.gov/.../all_day.geojson` | 5min | 100 | 7000ms | Sorted by magnitude desc |
| `useSatellites` | `celestrak.org/.../gp.php?GROUP=active&FORMAT=tle` | 30s | 200 | 3000ms | TLE fetched once, then `satellite.propagate()` every interval |
| `useTraffic` | `overpass-api.de/api/interpreter` | 2min | — | 5000ms | Bengaluru bbox `12.85,77.5,13.05,77.7` |
| `useWeather` | `opengeo.ncep.noaa.gov/...` (NOAA NEXRAD WMS) | 5min | — | 12000ms | Returns tile URL, not data |
| `useCCTV` | `overpass-api.de/api/interpreter` | static | 200 | — | Fetches once, `man_made=surveillance` |
| `useGemini` | Google Generative AI SDK | 60s | — | 15000ms | Dual-key fallback, structured prompt |

---

## 8. CSS Architecture

### File Split
- **`index.css`** — Tailwind v4 `@import "tailwindcss"` + CSS custom properties (design tokens)
- **`worldview.css`** — All visual effects (no Tailwind utilities, pure CSS)

### Design Tokens (CSS Custom Properties)
```css
--color-cyan: #00FFFF;         /* Primary UI color */
--color-cyan-dim: #00aaaa;     /* Subdued cyan */
--color-cyan-glow: rgba(0, 255, 255, 0.15);
--color-yellow: #FFD700;       /* Classification text */
--color-red: #FF3333;          /* Alerts, earthquakes */
--color-green: #00FF66;        /* Low priority */
--color-white: #E0E0E0;        /* Body text */
--color-bg: #000000;           /* Background */
--color-panel: rgba(0, 10, 20, 0.85);     /* Panel background */
--color-panel-border: rgba(0, 255, 255, 0.2); /* Panel borders */
--font-mono: 'Share Tech Mono', monospace;
```

### Visual Effects Stack (all in `worldview.css`)
1. **Globe container** — centered flex, black background
2. **Globe viewport** — `border-radius: 50%` with `overflow: hidden` (circular mask)
3. **Radial vignette** — `radial-gradient` from transparent center → black edges, `pointer-events: none`, `z-index: 10`
4. **CRT scanlines** — `repeating-linear-gradient` (2px transparent + 2px semi-black), `z-index: 11`
5. **Cesium widget overrides** — hide all default Cesium UI, round canvas corners

### Cesium UI Hidden (Critical)
All default Cesium widgets are force-hidden via CSS:
```css
.cesium-viewer-bottom, .cesium-viewer-toolbar,
.cesium-credit-logoContainer, /* ...and 10 more selectors */
{ display: none !important; }
```
This list is in `worldview.css`. **Do not remove these rules** or Cesium's default UI will appear.

---

## 9. Gemini Crisis Agent

### Configuration
- **API Keys**: `VITE_GEMINI_KEY_1` (primary), `VITE_GEMINI_KEY_2` (fallback) in `.env`
- **Model**: `gemini-pro`
- **Interval**: 60 seconds auto + manual trigger button

### Prompt Template
```
You are WORLDVIEW CRISIS ANALYST — a military intelligence AI.
[PRIORITY: HIGH/MED/LOW] Situation. Action. Impact.

Rules:
- Under 40 words total
- Use specific location names
- Never say "I" or "As an AI"
- No generic advice — be precise and actionable
- HIGH = imminent threat, MED = developing situation, LOW = routine
```

### Snapshot Data Sent
```
- Active flights: {count}
- Active satellites: {count}
- Earthquakes (24h): {count}
- Weather status: {summary}
- Traffic level: {level}
- Active layers: {comma-separated list}
```

### Fallback Behavior
Primary key fails → silently tries secondary key → if both fail, shows:
`[PRIORITY: LOW] Intelligence feed offline. Manual analysis required.`

---

## 10. Performance Considerations

### What to Watch
| Metric | Danger Zone | Cause |
|--------|------------|-------|
| Frame rate < 30fps | Too many entities or points | Raise caps or reduce pixelSize |
| Network tab shows simultaneous fetches | Stagger offsets too close | Increase stagger gaps |
| Memory > 500MB | Collections not cleaning up stale entries | Check Map cleanup in GlobeViewer |
| Shader errors in console | Wrong GLSL syntax | Must use `in`/`out`/`out_FragColor` |

### What NOT to Do
- ❌ Use `Entity` for flights or satellites (use PointPrimitiveCollection)
- ❌ Call `points.removeAll()` and rebuild on each data update (use Map diff)
- ❌ Store Cesium viewer in `useState` (use `useRef`)
- ❌ Fire all API calls at time 0 (stagger them)
- ❌ Use `varying`/`gl_FragColor` in shaders (use modern GLSL)
- ❌ Use `localStorage`/`sessionStorage` for anything

---

## 11. Common Tasks for Future AI

### Adding a New Data Layer
1. Create `src/hooks/useNewLayer.js` following the hook pattern in §7
2. Add layer ID to `DEFAULT_LAYERS` and `LAYER_META` in `WorldViewContext.jsx`
3. Add hook call in `App.jsx` with appropriate stagger offset
4. Add rendering code in `GlobeViewer.jsx` (choose primitive type per §5.2)
5. Data count/summary → sync to context in `App.jsx` useEffect

### Adding a New Visual Preset
1. Add GLSL shader string to `PRESET_SHADERS` in `GlobeViewer.jsx`
2. Add preset name to `PRESETS` array in `WorldViewContext.jsx`
3. It will automatically appear in `StylePresetsPanel.jsx`

### Adding a New Location
1. Add entry to `LOCATIONS` array in `LocationsPanel.jsx`
2. Format: `{ name: 'CITY NAME', lon: X, lat: Y, alt: Z }`

### Modifying the Gemini Prompt
1. Edit `SYSTEM_PROMPT` in `src/hooks/useGemini.js`
2. The snapshot data is built in `App.jsx` as `geminiSnapshot`

### Changing Refresh Intervals
1. Edit `REFRESH_MS` constant at the top of the relevant hook file
2. Edit stagger offset in `App.jsx` where the hook is called

---

## 12. Known Limitations & Gotchas

1. **OpenSky API rate limits** — unauthenticated requests are limited to ~10/minute. If flights stop loading, this is why.
2. **CelesTrak TLE file is large** — first satellite load takes 3–5 seconds. TLE is cached in `useRef` and only fetched once.
3. **Overpass API rate limits** — traffic and CCTV queries can be rate-limited. The hook handles errors gracefully.
4. **CORS on some APIs** — `adsb.lol` and some NOAA endpoints may need a CORS proxy in production.
5. **React 19 + Resium peer deps** — installed with `--legacy-peer-deps`. Do not remove this flag from install commands.
6. **Cesium ion token** — not currently set. Default Bing Maps imagery is used. For Google 3D Tiles, add a Cesium ion token or Google Maps API key.
7. **flyTo from LocationsPanel** — currently uses `container.__flyTo` pattern (function attached to DOM element). If refactoring, ensure flyTo access doesn't require forwardRef.

---

## 13. Environment Variables

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `VITE_GEMINI_KEY_1` | Optional | Primary Google Gemini API key |
| `VITE_GEMINI_KEY_2` | Optional | Fallback Gemini API key |

No other environment variables are needed. CesiumJS loads from `node_modules` via `vite-plugin-cesium`.

---

## 14. Running the Project

```bash
cd worldview
npm install --legacy-peer-deps    # Required due to React 19 + Resium peer deps
npm run dev                       # Starts Vite dev server on localhost:5173
```

---

*Last updated: 2026-03-11 by initial build session.*
