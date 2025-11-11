import { useEffect, useMemo, useState } from 'react'
import './App.css'
import MapView from './components/MapView'
import type { GeoJSON as GeoJSONType } from 'geojson'

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '/api'

interface CountryRow { country: string; name: string }
interface RegionRow { region: string; name: string }
interface Candidate { id?: string; subtype?: string; country?: string; region?: string; name: string }

export default function App() {
  const [countries, setCountries] = useState<CountryRow[]>([])
  const [regions, setRegions] = useState<RegionRow[]>([])
  const [hasRegions, setHasRegions] = useState<boolean | null>(null)

  const [country, setCountry] = useState<string>('us')
  const [region, setRegion] = useState<string>('')
  const [query, setQuery] = useState<string>('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)

  const [geom, setGeom] = useState<GeoJSONType | null>(null)
  const [loadedPlace, setLoadedPlace] = useState<string>('')

  const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]+/g, '')

  const downloadBoundary = () => {
    if (!geom) return
    const feature = {
      type: 'Feature',
      geometry: geom,
      properties: {
        name: loadedPlace || 'boundary',
        country: country || null,
        region: region || null,
        source: 'wkls-vis',
      },
    }
    const filename = `${slug(country || 'all')}_${slug(region || 'all')}_${slug(loadedPlace || 'boundary')}.geojson`
    const blob = new Blob([JSON.stringify(feature)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Load countries on mount
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE}/countries`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load countries')
        setCountries(await r.json())
      })
      .catch((e) => {
        if (e.name !== 'AbortError') console.error('Failed to load countries', e)
      })
    return () => controller.abort()
  }, [])

  // Load regions when country changes
  useEffect(() => {
    if (!country) return
    setRegion('')
    setHasRegions(null)
    const controller = new AbortController()
    fetch(`${API_BASE}/regions?country=${encodeURIComponent(country)}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        const data = await r.json()
        setRegions(data)
        setHasRegions(true)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setRegions([])
          setHasRegions(false) // no regions for this country
        }
      })
    return () => controller.abort()
  }, [country])

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => {
      if (!country || query.trim().length < 2) {
        setCandidates([])
        return
      }
      const params = new URLSearchParams({ country: country.toLowerCase(), q: `%${query}%` })
      if (hasRegions && region) params.set('region', region.toLowerCase())
      const controller = new AbortController()
      fetch(`${API_BASE}/search?${params.toString()}`, { signal: controller.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error('Search failed')
          setCandidates(await r.json())
        })
        .catch((e) => {
          if (e.name !== 'AbortError') console.warn('Search failed', e)
        })
    }, 300)
    return () => clearTimeout(id)
  }, [country, region, query, hasRegions])

  const onPickCandidate = async (c: Candidate) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ country: country.toLowerCase(), place: (c.name || '').toLowerCase() })
      if (hasRegions && region) params.set('region', region.toLowerCase())
      console.log('Fetching boundary:', `${API_BASE}/boundary?${params.toString()}`)
      const r = await fetch(`${API_BASE}/boundary?${params.toString()}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      console.log('Received boundary:', data.type, data)
      setGeom(data)
      setLoadedPlace(c.name)
      setCandidates([]) // Clear search results after loading
      setQuery('') // Clear search box
    } catch (e) {
      console.error('Failed to load boundary', e)
    } finally {
      setLoading(false)
    }
  }

  const regionOptions = useMemo(() => regions.map((r) => ({ value: r.region.split('-').pop()!.toLowerCase(), label: r.name })), [regions])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MapView data={geom} />
      
      {/* Floating search panel */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '20px',
        minWidth: 340,
        maxWidth: 380,
        zIndex: 1000,
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>Boundary Explorer</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#555' }}>Country</label>
            <select 
              value={country} 
              onChange={(e) => setCountry(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 14,
                background: 'white',
                color: '#1a1a1a',
              }}
            >
              {countries.map((c) => (
                <option key={c.country} value={c.country.toLowerCase()}>
                  {c.country.toUpperCase()} – {c.name}
                </option>
              ))}
            </select>
          </div>

          {hasRegions && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#555' }}>Region</label>
              <select 
                value={region} 
                onChange={(e) => setRegion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                  background: 'white',
                  color: '#1a1a1a',
                }}
              >
                <option value="">All regions</option>
                {regionOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#555' }}>Search place</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 14,
                boxSizing: 'border-box',
                background: 'white',
                color: '#1a1a1a',
              }}
            />
            {query.length > 0 && query.length < 2 && (
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#999' }}>Type at least 2 characters</p>
            )}
          </div>

          {candidates.length > 0 && (
            <div style={{
              maxHeight: 200,
              overflow: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              background: '#fafafa',
            }}>
              {candidates.map((c, i) => (
                <div
                  key={i}
                  onClick={() => onPickCandidate(c)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: i < candidates.length - 1 ? '1px solid #e0e0e0' : 'none',
                    transition: 'background 0.15s',
                    color: '#1a1a1a',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fafafa'}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                  {c.subtype && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{c.subtype}</div>}
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '8px', color: '#666', fontSize: 14 }}>
              Loading boundary...
            </div>
          )}

          {geom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <details style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <summary style={{
                  listStyle: 'none',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  background: '#f3f4f6',
                  fontWeight: 600,
                  color: '#111827',
                }}>Export</summary>
                <div style={{ padding: 12, background: 'white' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={downloadBoundary}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #2563eb',
                        borderRadius: 8,
                        background: '#2563eb',
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ⬇️ Download GeoJSON
                    </button>

                    <button
                      onClick={async () => {
                        // download WKT
                        const params = new URLSearchParams({ country: country.toLowerCase(), place: (loadedPlace || '').toLowerCase(), fmt: 'wkt' })
                        if (hasRegions && region) params.set('region', region.toLowerCase())
                        const r = await fetch(`${API_BASE}/boundary?${params.toString()}`)
                        const text = await r.text()
                        const blob = new Blob([text], { type: 'text/plain' })
                        const a = document.createElement('a')
                        const url = URL.createObjectURL(blob)
                        const filename = `${slug(country || 'all')}_${slug(region || 'all')}_${slug(loadedPlace || 'boundary')}.wkt`
                        a.href = url
                        a.download = filename
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        URL.revokeObjectURL(url)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #374151',
                        borderRadius: 8,
                        background: '#111827',
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ⬇️ Download WKT
                    </button>

                    <button
                      onClick={async () => {
                        // copy WKT to clipboard
                        const params = new URLSearchParams({ country: country.toLowerCase(), place: (loadedPlace || '').toLowerCase(), fmt: 'wkt' })
                        if (hasRegions && region) params.set('region', region.toLowerCase())
                        const r = await fetch(`${API_BASE}/boundary?${params.toString()}`)
                        const text = await r.text()
                        try {
                          await navigator.clipboard.writeText(text)
                          alert('WKT copied to clipboard')
                        } catch {
                          // fallback
                          const ta = document.createElement('textarea')
                          ta.value = text
                          document.body.appendChild(ta)
                          ta.select()
                          document.execCommand('copy')
                          ta.remove()
                          alert('WKT copied to clipboard')
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #10b981',
                        borderRadius: 8,
                        background: '#10b981',
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      📋 Copy WKT
                    </button>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Loaded place indicator */}
      {loadedPlace && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          zIndex: 1000,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          📍 {loadedPlace}
        </div>
      )}
    </div>
  )
}
