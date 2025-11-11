# Boundary Explorer — Frontend (web)

React + Vite + TypeScript app that renders administrative boundaries with MapLibre GL.

## Stack
- React, Vite, TypeScript
- MapLibre GL for map rendering (GPU-accelerated)
- @turf/bbox for auto-fitting loaded geometry

## Getting started
```bash
pnpm --dir web install     # install deps
pnpm --dir web dev         # start Vite (http://localhost:5173)
```
The dev proxy forwards `/api` → `http://localhost:8000` (see `vite.config.ts`). Start the backend separately:
```bash
uv run uvicorn server.app.main:app --reload --port 8000
```

## Environment
- Optional: `VITE_API_BASE` (defaults to `/api`). Create `web/.env.local` if you need to point at a different API host:
```env
VITE_API_BASE=http://your-host:your-port/api
```

## Scripts
```bash
pnpm --dir web build        # type-check + build
pnpm --dir web preview      # serve the production build
pnpm --dir web lint         # eslint
pnpm --dir web tsc -b --noEmit  # type-check only
```

## Key files
- `src/App.tsx` — UI (country/region/search, export GeoJSON/WKT, projection toggle)
- `src/components/MapView.tsx` — MapLibre GL map: GeoJSON source + fill/line layers, auto-fit via `@turf/bbox`, Map/Globe projection via `setProjection`
- `src/main.tsx` — imports `maplibre-gl/dist/maplibre-gl.css`
- `vite.config.ts` — dev server proxy `/api` → backend

## Basemap
- Uses CARTO Dark Matter raster tiles (no API key). To use a vector style, pass a MapLibre style JSON URL in the map init.

## Favicon
- Globe emoji favicon is set in `web/index.html`.

## Troubleshooting
- If the globe view looks odd, ensure the MapLibre CSS is loaded (`import 'maplibre-gl/dist/maplibre-gl.css'` in `src/main.tsx`).
- If API calls fail in dev, verify the backend is running on port 8000 or set `VITE_API_BASE`.
