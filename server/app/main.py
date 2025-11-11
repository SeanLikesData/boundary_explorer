from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import json
import logging
import wkls
from functools import lru_cache
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wkls-vis")

app = FastAPI(title="wkls-vis API")

# Avoid DuckDB concurrency issues: serialize all wkls/duckdb access
_DUCK_LOCK = threading.RLock()

def _with_duck_lock(fn, *args, **kwargs):
    # retry once on transient InvalidInputException
    try:
        with _DUCK_LOCK:
            return fn(*args, **kwargs)
    except Exception:
        with _DUCK_LOCK:
            return fn(*args, **kwargs)

# Cache wkls lookups to speed up repeated queries (post-lock, safe results)
@lru_cache(maxsize=128)
def get_countries_cached():
    return _with_duck_lock(lambda: wkls.countries().to_dict("records"))

@lru_cache(maxsize=128)
def get_regions_cached(country: str):
    def _fn():
        obj = wkls[country.lower()]
        return obj.regions().to_dict("records")
    return _with_duck_lock(_fn)

@lru_cache(maxsize=256)
def get_search_cached(country: str, region: str, q: str):
    def _fn():
        obj = wkls[country.lower()]
        if region:
            obj = obj[region.lower()]
        df = obj[q]
        cols = [c for c in ["id", "subtype", "country", "region", "name"] if c in df.columns]
        return df[cols].to_dict("records")
    return _with_duck_lock(_fn)

@lru_cache(maxsize=256)
def get_boundary_cached(country: str, region: str, place: str):
    def _fn():
        obj = wkls[country.lower()]
        if region:
            obj = obj[region.lower()]
        if place:
            obj = obj[place.lower()]
        geojson_str = obj.geojson()
        return json.loads(geojson_str)
    return _with_duck_lock(_fn)

@lru_cache(maxsize=256)
def get_wkt_cached(country: str, region: str, place: str) -> str:
    def _fn():
        obj = wkls[country.lower()]
        if region:
            obj = obj[region.lower()]
        if place:
            obj = obj[place.lower()]
        return obj.wkt()
    return _with_duck_lock(_fn)

# Dev CORS (adjust as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/version")
def version():
    return {"overture": wkls.overture_version()}

@app.get("/api/countries")
def countries():
    try:
        return get_countries_cached()
    except Exception as e:
        logger.exception("/api/countries failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/regions")
def regions(country: str):
    try:
        return get_regions_cached(country.lower())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("/api/regions failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/places")
def places(country: str, region: str | None = None, kind: str = "all"):
    obj = wkls[country.lower()]
    if region:
        obj = obj[region.lower()]
    try:
        if kind == "cities":
            df = obj.cities()
        elif kind == "counties":
            df = obj.counties()
        else:
            parts = []
            try:
                parts.append(obj.cities())
            except Exception:
                pass
            try:
                parts.append(obj.counties())
            except Exception:
                pass
            import pandas as pd
            df = pd.concat(parts, ignore_index=True) if parts else parts
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("/api/places failed")
        raise HTTPException(status_code=500, detail=str(e))
    return (df.to_dict("records") if hasattr(df, "to_dict") else [])

@app.get("/api/search")
def search(country: str, region: str | None = None, q: str = "%"):
    try:
        return get_search_cached(country.lower(), region.lower() if region else "", q)
    except Exception as e:
        logger.exception("/api/search failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/boundary")
def boundary(country: str, region: str | None = None, place: str | None = None, fmt: str = "geojson"):
    try:
        c = country.lower()
        r = region.lower() if region else ""
        p = place.lower() if place else ""
        if fmt == "wkt":
            wkt = get_wkt_cached(c, r, p)
            return PlainTextResponse(content=wkt, media_type="text/plain; charset=utf-8")
        # default: geojson
        geom = get_boundary_cached(c, r, p)
        return JSONResponse(content=geom, media_type="application/geo+json")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("/api/boundary failed")
        raise HTTPException(status_code=500, detail=str(e))
