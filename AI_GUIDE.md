# wkls Usage Guide

A practical guide to working with global administrative boundaries using the `wkls` Python library. `wkls` gives you a fluent, chainable way to access countries → regions → places and retrieve geometry in multiple formats from the Overture Maps dataset (2025-09-24.0).

## Installation

```bash
pip install wkls
```

## Quick start

```python
import wkls

# Chain country → region → place, then fetch geometry
print(wkls.us.ca.sanfrancisco.wkt()[:120])
print(wkls.overture_version())  # '2025-09-24.0'
```

## Core concepts

### Chaining

Chains are up to 3 segments: country → region → place.
- Country is a 2-letter ISO code (e.g., `us`, `de`)
- Region uses the ISO suffix for that country (e.g., `ca` → `US-CA`)
- Place matches names in subtypes: `county`, `locality`, `localadmin`, `neighborhood`

Examples:
```python
wkls.us.wkt()                 # Country: United States
wkls.us.ca.wkt()              # Region: California
wkls.us.ca.sanfrancisco.wkt() # Place: San Francisco
```

### Case and spaces

Place matching is case-insensitive and ignores spaces. The library uses a SQL ILIKE with `REPLACE(name, ' ', '')` to normalize names.

### Search patterns with %

Use SQL-like `%` wildcards inside bracket lookups to search by name and return a Pandas DataFrame of matches.
```python
# Two common matches for “San Francisco”: county and city
matches = wkls["us"]["ca"]["%san francisco%"]
print(matches[["id", "subtype", "name"]])
```
If a chain resolves to multiple rows and you call a geometry method directly, `wkls` uses the first row. Prefer refining your query or using listing helpers (below) to disambiguate.

## Geometry formats

Each geometry method reads only when called (lazy). Data is pulled from Overture Maps S3 via DuckDB spatial functions.
```python
sf = wkls.us.ca.sanfrancisco
wkt = sf.wkt()          # str, starts with 'MULTIPOLYGON' or 'POLYGON'
wkb = sf.wkb()          # bytearray
hexwkb = sf.hexwkb()    # str (hex-encoded WKB)
geojson = sf.geojson()  # str (JSON)
svg = sf.svg()          # str (SVG path)
```
`svg(relative=False, precision=15)` accepts optional arguments mirroring DuckDB’s `ST_AsSVG`.

Example: parse GeoJSON
```python
import json
geom = json.loads(wkls.us.ca.sanfrancisco.geojson())
print(geom["type"], type(geom))
```

## Listing helpers (exploration)

These return Pandas DataFrames.
```python
wkls.countries()           # All countries
wkls.dependencies()        # All dependencies (e.g., territories)
wkls.us.regions()          # Regions for a country (one-level chain required)
wkls.us.ca.counties()      # Counties for a region (two-level chain)
wkls.us.ca.cities()        # Cities for a region (two-level chain)
wkls.subtypes()            # Distinct subtypes present in the dataset
```

## Countries without regions

Some countries/dependencies do not have regions in the dataset. For those, call `cities()` or `counties()` directly on the country.
```python
wkls.fk.cities()     # OK: Falkland Islands have no regions
wkls.fk.counties()   # OK
# wkls.fk.regions()  # Raises ValueError explaining the correct usage
# wkls.us.cities()   # Raises ValueError; the US has regions, specify one first
```

## Disambiguating places

If a name matches multiple subtypes, refine the query:
- Include more of the name in a `%...%` search
- List candidates first, then choose the right one and adjust the chain

```python
candidates = wkls["us"]["ca"]["%san francisco%"]
print(candidates[["subtype", "name"]])
# If you specifically want the county boundary, try using the county’s full name
county = wkls.us.ca["%san francisco county%"]
print(county.wkt()[:120])
```

## Programmatic access

You can build chains dynamically using bracket access.
```python
def boundary(country: str, region: str | None = None, place: str | None = None) -> str:
    obj = wkls[country]
    if region:
        obj = obj[region]
    if place:
        obj = obj[place]
    return obj.wkt()

print(boundary("us", "ca", "sanfrancisco")[:120])
```

## Dataset version

The Overture Maps dataset version is fixed in the library and available at the root only.
```python
print(wkls.overture_version())   # '2025-09-24.0'
# wkls.us.overture_version()    # Raises ValueError (root-only)
```

## Saving results

```python
# Save GeoJSON to a file
import json
geojson_str = wkls.us.ny.newyork.geojson()
with open("newyork.geojson", "w") as f:
    f.write(geojson_str)

# Save WKT
with open("california.wkt", "w") as f:
    f.write(wkls.us.ca.wkt())
```

## Troubleshooting

- No or slow results on first use: DuckDB may be installing and loading `spatial` and `httpfs` extensions and reading from S3.
- ValueError about chain depth or method placement: Follow the messages; some helpers are root-only or require a specific chain length (e.g., `wkls.us.regions()`).
- “No result found for: …”: The chain did not resolve to any rows. Check the ISO codes and spelling, or use a `%...%` search.

## Reference summary

Key files informing this guide:
- `wkls/__init__.py` – exposes a singleton `Wkl` instance so attribute access becomes queries
- `wkls/core.py` – DuckDB init, chain resolution, geometry methods, and helper listings
- `tests/` – examples of real lookups (`us`, `us.ca.sanfrancisco`, `fk`) and method behavior

## Cookbook: common tasks

1) Save any boundary to GeoJSON by human name
```python
import wkls

def save_geojson(country, region=None, place=None, path=None):
    obj = wkls[str(country).lower()]
    if region:
        obj = obj[str(region).lower()]
    if place:
        obj = obj[str(place).lower()]
    geojson = obj.geojson()
    path = path or f"{country}_{region or 'all'}_{place or 'all'}.geojson".replace(' ', '_').lower()
    with open(path, 'w') as f:
        f.write(geojson)
    return path

save_geojson('US', 'CA', 'San Francisco')
```

2) Write WKT for every region in a country
```python
import wkls, os

os.makedirs('out/wkt', exist_ok=True)
regions = wkls.us.regions()
for _, row in regions.iterrows():
    suffix = row['region'].split('-')[-1]
    geom = wkls['us'][suffix.lower()].wkt()
    with open(f"out/wkt/{suffix.lower()}.wkt", 'w') as f:
        f.write(geom)
```

3) Disambiguate a name by subtype (e.g., pick the city over the county)
```python
import wkls
import pandas as pd

matches = wkls['us']['ca']['%san francisco%']
city = matches[matches['subtype'] == 'locality'].iloc[0]
obj = wkls[city['country'].lower()][city['region'].split('-')[-1].lower()][city['name'].lower()]
print(obj.wkt()[:120])
```

4) Count cities per region in a country
```python
import wkls
import pandas as pd

regions = wkls.us.regions()
rows = []
for _, r in regions.iterrows():
    suffix = r['region'].split('-')[-1].lower()
    n = len(wkls['us'][suffix].cities())
    rows.append({'region': r['region'], 'cities': n})

summary = pd.DataFrame(rows).sort_values('cities', ascending=False)
print(summary.head())
```

5) Quick SVG preview as a standalone HTML file
```python
import wkls, pathlib

svg_path = wkls.us.ca.sanfrancisco.svg(precision=5)
html = f"""
<html><body>
<svg viewBox='0 0 1000 1000'>
  <path d=\"{svg_path}\" fill='none' stroke='black'/>
</svg>
</body></html>
"""
path = pathlib.Path('sf.html')
path.write_text(html, encoding='utf-8')
print(f'Wrote {path.resolve()}')
```

6) Countries without regions: list cities and save one
```python
import wkls

cities = wkls.fk.cities()
name = cities.iloc[0]['name']
geojson = wkls.fk[name.lower()].geojson()
with open('fk_first_city.geojson', 'w') as f:
    f.write(geojson)
```
