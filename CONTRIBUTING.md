# Contributing to Worldview

Thank you for your interest in contributing to Worldview! This document outlines guidelines and architectural conventions to maintain code quality, security, and performance.

---

## Architectural Rules

1. **High-Performance Rendering**: Use `PointPrimitiveCollection` for high-count entities (flights, satellites, ships). Never create individual Cesium `Entity` objects for datasets exceeding 100 objects.
2. **In-Place Updates**: Update 3D position primitives in-place using `Map` lookups. Avoid clearing and rebuilding collections on every frame to prevent garbage collection spikes.
3. **Cesium Viewer Management**: Store the Cesium `Viewer` instance inside a React `useRef`. Never store the viewer in React `useState`.
4. **Secret Isolation**: Never introduce raw API keys in client-side code (`src/`). All authenticated or rate-sensitive API calls must be routed through the server proxy (`server/index.js`).
5. **No Persistence**: State is ephemeral. Do not use `localStorage` or `sessionStorage`.

---

## Development Workflow

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/worldview.git
   cd worldview/worldview
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start backend API proxy & Vite dev server:
   ```bash
   npm run server   # In terminal 1
   npm run dev      # In terminal 2
   ```

4. Run linting and build checks before submitting code:
   ```bash
   npm run lint
   npm run build
   ```

---

## Pull Request Guidelines

- Ensure ESLint passes cleanly without warnings or errors.
- Keep commits focused and provide clear, descriptive commit messages.
- Do not commit secrets, `.env` files, build outputs (`dist/`), or `node_modules/`.
