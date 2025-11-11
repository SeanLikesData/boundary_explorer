# wkls-vis

A lightweight React + Python visualization tool for exploring administrative boundaries using the [wkls](https://github.com/stvswnn/wkls) library.

## Architecture
- **Backend**: FastAPI with endpoints that wrap wkls (countries, regions, places, search, boundary GeoJSON)
- **Frontend**: React + Vite + TypeScript + Leaflet for map rendering
- **Transport**: GeoJSON via JSON REST API
- **Performance**: LRU cache for repeated wkls queries; abort controller for fetch cleanup

## Dev setup

### Backend
```bash
# From project root
uv run uvicorn server.app.main:app --reload --port 8000
```

### Frontend
```bash
# From project root
pnpm --dir web dev
```

Open http://localhost:5173

## Usage
1. Select a country from the dropdown (e.g., US)
2. If the country has regions, select one (e.g., CA)
3. Type at least 2 characters to search for a place (wildcards added automatically)
4. Click a result to load and visualize the boundary on the map

## Endpoints
- `GET /api/health` → `{"ok": true}`
- `GET /api/version` → `{"overture": "2025-09-24.0"}`
- `GET /api/countries` → list of countries
- `GET /api/regions?country=us` → list of regions for US
- `GET /api/places?country=us&region=ca&kind=cities|counties|all` → list of places
- `GET /api/search?country=us&region=ca&q=%san francisco%` → search results
- `GET /api/boundary?country=us&region=ca&place=san francisco` → GeoJSON geometry

## File layout
```
wkls_vis/
  server/
    app/main.py         - FastAPI app with wkls endpoints
    pyproject.toml      - Python dependencies (managed by uv)
  web/
    src/
      App.tsx           - Main UI (country/region/place selectors, map)
      components/
        MapView.tsx     - Leaflet map with GeoJSON overlay and auto-fit
    vite.config.ts      - Vite dev server with proxy to backend
  README.md             - This file
```

## Performance notes
- Backend uses `@lru_cache` to cache wkls DataFrame and GeoJSON lookups
- Frontend uses AbortController to cancel in-flight requests when component unmounts or query changes
- GeoJSON layer gets a stable key to prevent Leaflet console errors on re-render

## Dependencies
- Python: fastapi, uvicorn, wkls, pandas (managed by `uv`)
- JS: react, react-leaflet, leaflet, vite, typescript (managed by `pnpm`)
