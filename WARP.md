# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview
Monorepo for a lightweight boundary explorer built with:
- Backend: FastAPI wrapping the wkls library
- Frontend: React + Vite + TypeScript + MapLibre GL

## Repo layout
- `server/` — FastAPI app (`server/app/main.py`), dependencies in `server/pyproject.toml` (use uv)
- `web/` — React app (Vite config in `web/vite.config.ts`, ESLint in `web/eslint.config.js`)

## Architecture and data flow
### Backend (FastAPI)
- All wkls/DuckDB access is serialized via a process-wide `threading.RLock` to avoid concurrency issues; results are cached using `functools.lru_cache`.
- Endpoints:
  - `GET /api/health`, `GET /api/version`
  - `GET /api/countries` → rows from `wkls.countries()`
  - `GET /api/regions?country=xx`
  - `GET /api/places?country=xx[&region=yy][&kind=cities|counties|all]`
  - `GET /api/search?country=xx[&region=yy]&q=%term%`
  - `GET /api/boundary?country=xx[&region=yy][&place=name][&fmt=geojson|wkt]` → GeoJSON geometry or WKT
- CORS allows `http://localhost:5173` and `http://127.0.0.1:5173` for local dev.

### Frontend (React + Vite)
- Dev proxy: requests starting with `/api` are proxied to `http://localhost:8000` (see `web/vite.config.ts`).
- `web/src/App.tsx` orchestrates: load countries/regions, debounced search (≥2 chars; `%` wildcards), fetch boundary, export GeoJSON/WKT.
- `web/src/components/MapView.tsx` renders the MapLibre GL map, supports a Map/Globe projection toggle, adds GeoJSON as a source with line/fill layers, and auto-fits bounds using @turf/bbox.

### Environment
- Frontend reads `VITE_API_BASE` (defaults to `/api`). In dev you normally rely on the Vite proxy; set this if calling a different API host.
- Default ports: backend `8000`, frontend `5173`.

## Common commands
Use uv for Python and pnpm for Node.

- Install frontend deps
```bash
pnpm --dir web install
```

- Run backend (uv + uvicorn)
```bash
uv run uvicorn server.app.main:app --reload --port 8000
```

- Run frontend (Vite dev, with proxy to backend)
```bash
pnpm --dir web dev
```

- Lint frontend
```bash
pnpm --dir web lint
```

- Type-check frontend only
```bash
pnpm --dir web tsc -b --noEmit
```

- Build frontend
```bash
pnpm --dir web build
```

- Preview built frontend
```bash
pnpm --dir web preview
```

## Testing
No test suite is configured in `server/` or `web/`. If tests are added later, document the commands here (and how to run a single test).

## Notes for future automation
- Start the backend before the frontend so the Vite proxy can reach `/api`.
- The frontend wraps the raw geometry from `/api/boundary` into a Feature object for `.geojson` downloads.
