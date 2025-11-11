import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import bbox from '@turf/bbox'
import type { GeoJSON as GeoJSONType, Feature, Geometry } from 'geojson'

function isFeature(g: GeoJSONType): g is Feature<Geometry> {
  return (g as Feature<Geometry>).type === 'Feature' && !!(g as Feature<Geometry>).geometry
}

function toFeature(geom: GeoJSONType): Feature<Geometry> {
  if (isFeature(geom)) return geom
  return {
    type: 'Feature',
    geometry: geom as Geometry,
    properties: {},
  }
}

export default function MapView({ data, projection }: { data: GeoJSONType | null; projection: 'mercator' | 'globe' }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  // init map once
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      // Raster basemap (no API key required)
      style: {
        version: 8,
        projection: { type: 'mercator' },
        sources: {
          rastertiles: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
          },
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'rastertiles', minzoom: 0, maxzoom: 20 },
        ],
      },
      center: [0, 20],
      zoom: 2,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    // Apply initial projection once style is ready
    map.once('style.load', () => {
      try { map.setProjection({ type: projection }) } catch { /* ignore projection errors on init */ }
    })

    mapRef.current = map
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [projection])

  // Switch projection when prop changes (after init)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded?.()) {
      try { map.setProjection({ type: projection }) } catch { /* ignore projection errors when toggling */ }
    } else {
      map.once('style.load', () => {
        try { map.setProjection({ type: projection }) } catch { /* ignore projection errors after style load */ }
      })
    }
  }, [projection])

  // update boundary layer when data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const hasSource = !!map.getSource('boundary')

    if (!data) {
      if (map.getLayer('boundary-line')) map.removeLayer('boundary-line')
      if (map.getLayer('boundary-fill')) map.removeLayer('boundary-fill')
      if (hasSource) map.removeSource('boundary')
      return
    }

    const feature = toFeature(data)

    if (!hasSource) {
      map.addSource('boundary', {
        type: 'geojson',
        data: feature,
      })
      if (!map.getLayer('boundary-fill')) {
        map.addLayer({
          id: 'boundary-fill',
          type: 'fill',
          source: 'boundary',
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 },
        })
      }
      if (!map.getLayer('boundary-line')) {
        map.addLayer({
          id: 'boundary-line',
          type: 'line',
          source: 'boundary',
          paint: { 'line-color': '#3b82f6', 'line-width': 2.5 },
        })
      }
    } else {
      const src = map.getSource('boundary') as maplibregl.GeoJSONSource
      src.setData(feature)
    }

    try {
      const [minX, minY, maxX, maxY] = bbox(feature as unknown as GeoJSONType)
      if (Number.isFinite(minX)) {
        map.fitBounds(
          [
            [minX, minY],
            [maxX, maxY],
          ],
          { padding: 20 },
        )
      }
    } catch {
      // ignore bbox failures
    }
  }, [data])

  return <div ref={containerRef} style={{ height: '100vh', width: '100vw' }} />
}
