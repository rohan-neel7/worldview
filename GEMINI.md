# GEMINI.md - WorldView Project Context

## Project Overview
**WorldView** is a real-time 3D global intelligence dashboard built with React 19, Vite 7, and CesiumJS. It provides a cinematic, "Palantir-style" operational command interface, rendering a circular 3D Earth globe with live data overlays for flights, satellites, earthquakes, ships, and weather. It also features a Google Gemini-powered crisis intelligence agent.

### Key Technologies
- **Frontend:** React 19, Vite 7, Tailwind CSS v4.
- **3D Engine:** CesiumJS (Raw API used for performance, not Resium components).
- **AI:** Google Generative AI (Gemini Pro) for real-time situational analysis.
- **Data:** satellite.js (orbital propagation), OpenSky (flights), CelesTrak (satellites), USGS (earthquakes).

---

## Architecture & Mandatory Rules
The project follows strict performance and architectural rules defined in `WORLDVIEW_CONTEXT.md`. **NEVER violate these rules.**

1.  **High-Performance Rendering:** Use `PointPrimitiveCollection` for flights and satellites. **Never** use individual `Entity` objects for high-count data (500+ objects).
2.  **In-Place Updates:** Update positions in-place using `Map` lookups. **Never** clear and rebuild collections on every data refresh to avoid GC spikes and flickering.
3.  **Viewer Management:** Store the Cesium `Viewer` instance in a `useRef`. **Never** use `useState`, as it triggers expensive re-renders that would destroy the viewer.
4.  **Global State:** All shared state must reside in `WorldViewContext`.
5.  **Data Flow:** Unidirectional flow (Data DOWN via props, Events UP via callbacks).
6.  **Error Handling:** Wrap all asynchronous operations in `try/catch` blocks.
7.  **Data Caps:** Strictly enforce hard caps: Flights (500), Satellites (200), Earthquakes (100).
8.  **Staggered Fetches:** Stagger API feed intervals to prevent network contention (e.g., flights at 0s, satellites at +3s).
9.  **Modern GLSL:** Use WebGL2/GLSL 300es syntax (e.g., `in vec2 v_textureCoordinates`, `out_FragColor`).
10. **No Persistence:** **Never** use `localStorage` or `sessionStorage`. All state is ephemeral.

---

## Building and Running
The main application is located in the `worldview/` directory.

### Commands (Run within the `worldview/` directory)
- **Install Dependencies:** `npm install --legacy-peer-deps` (The flag is required due to React 19 + Resium peer dependency conflicts).
- **Development:** `npm run dev` (Starts Vite server on `localhost:5173`).
- **Build:** `npm run build` (Generates production assets in `dist/`).
- **Lint:** `npm run lint`.

### Configuration
- **API Keys:** Add `VITE_GEMINI_KEY_1` and `VITE_GEMINI_KEY_2` to `worldview/.env` for Gemini AI functionality.

---

## Key Directories & Files
- `worldview/src/components/GlobeViewer.jsx`: The core Cesium viewer and rendering logic for all data layers.
- `worldview/src/WorldViewContext.jsx`: Centralized state management for layers, presets, and counts.
- `worldview/src/hooks/`: Custom hooks for data fetching (e.g., `useFlights`, `useSatellites`, `useGemini`).
- `worldview/src/worldview.css`: Visual effects including the circular viewport, vignette, and CRT scanlines.
- `worldview/WORLDVIEW_CONTEXT.md`: The definitive guide for all architectural decisions and constraints.

---

## Development Conventions
- **Hooks:** Every data hook must follow the pattern of staggered initialization, internal intervals, and cleanup of both timeouts and intervals.
- **Shaders:** Visual presets (CRT, NVG, FLIR, etc.) are applied as `PostProcessStage` instances using raw GLSL shaders in `GlobeViewer.jsx`.
- **UI:** The HUD (CoordinateDisplay, ClassificationBar) overlays the 3D globe. Default Cesium UI elements are force-hidden via CSS.
- **AI Prompting:** The Gemini agent uses a specific military-style prompt template defined in `useGemini.js`.
