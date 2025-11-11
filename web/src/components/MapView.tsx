import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import type { GeoJSON as GeoJSONType } from 'geojson'

function FitBounds({ data }: { data: GeoJSONType | null }) {
  const map = useMap()
  useEffect(() => {
    if (!data) return
    const layer = L.geoJSON(data as any)
    const bounds = layer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.05))
    }
  }, [data, map])
  return null
}

export default function MapView({ data }: { data: GeoJSONType | null }) {
  // Stable key forces GeoJSON layer to unmount/remount when data changes (prevents leaflet console errors)
  const dataKey = useMemo(() => (data ? JSON.stringify(data).slice(0, 100) : 'no-data'), [data])

  // CARTO Dark Matter (no key required)
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  const attribution = '&copy; OpenStreetMap contributors &copy; CARTO'

  return (
    <MapContainer style={{ height: '100vh', width: '100vw' }} center={[20, 0]} zoom={2} scrollWheelZoom>
      <TileLayer 
        url={tileUrl}
        attribution={attribution}
        minZoom={0}
        maxZoom={22}
        detectRetina
      />
      <FitBounds data={data} />
      {data && (
        <GeoJSON key={dataKey} data={data as any} style={() => ({ color: '#3b82f6', weight: 2.5, fillColor: '#3b82f6', fillOpacity: 0.1 })} />
      )}
    </MapContainer>
  )
}
