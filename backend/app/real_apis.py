"""
🌐 NagarIQ Real-Time API Integration Layer
Replaces simulated/hardcoded data with live free public APIs

FREE APIs INTEGRATED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. OpenWeatherMap  → Real AQI + Rainfall     (free: 1,000 calls/day)
2. OSRM Demo       → Real road routing/ETA   (free: no key needed)
3. OSM Overpass    → Real hospital locations (free: no key needed)
4. Nominatim       → Reverse geocoding       (free: no key needed) ← ALREADY ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HONEST LIMITATIONS (no free public API exists):
- Hospital bed counts         → Still simulated (NHA ABDM requires Govt registration)
- Police crime history        → Still simulated (Not public API)
- Vahan vehicle database      → Still simulated (Requires NIC registration)
- CWC real river water levels → Still simulated (No public REST API)
  ↳ BUT: Flood sensors now use REAL rainfall data from OpenWeatherMap

HOW TO GET YOUR FREE API KEY:
1. Go to https://openweathermap.org/api
2. Create free account
3. Go to API Keys tab → copy default key
4. Paste it in backend/.env as: OPENWEATHER_API_KEY=your_key_here
5. Wait 10 minutes for key activation
6. Restart uvicorn → AQI and flood data go live automatically
"""

import os
import requests
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()  # Load .env so OPENWEATHER_API_KEY is available

OPENWEATHER_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OWM_BASE = "https://api.openweathermap.org"
OSRM_BASE = "https://router.project-osrm.org"
OVERPASS_BASE = "https://overpass-api.de/api/interpreter"

# ─────────────────────────────────────────────
# 1. OPENWEATHERMAP — REAL AQI DATA
# ─────────────────────────────────────────────

def get_real_aqi(lat: float, lng: float) -> Optional[Dict]:
    """
    Fetches real AQI + pollutant breakdown from OpenWeatherMap Air Pollution API.
    Free tier: 1,000 calls/day.
    
    Returns None if API key missing or call fails (caller falls back to simulation).
    """
    if not OPENWEATHER_KEY:
        return None
    
    try:
        r = requests.get(
            f"{OWM_BASE}/data/2.5/air_pollution",
            params={"lat": lat, "lon": lng, "appid": OPENWEATHER_KEY},
            timeout=5
        )
        r.raise_for_status()
        data = r.json()
        
        if not data.get("list"):
            return None
        
        item = data["list"][0]
        comp = item.get("components", {})
        
        # OWM AQI scale: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
        owm_aqi_index = item["main"]["aqi"]
        
        # Convert to India's CPCB AQI scale (0-500)
        cpcb_aqi_map = {1: 25, 2: 75, 3: 150, 4: 275, 5: 375}
        cpcb_aqi = cpcb_aqi_map.get(owm_aqi_index, 100)
        
        # Add PM2.5 contribution if available
        pm25 = comp.get("pm2_5", 0)
        if pm25 > 60:
            cpcb_aqi = max(cpcb_aqi, int(pm25 * 3.2))
        
        labels = {1: "Good", 2: "Satisfactory", 3: "Moderate", 4: "Poor", 5: "Very Poor/Hazardous"}
        
        return {
            "aqi": cpcb_aqi,
            "label": labels.get(owm_aqi_index, "Unknown"),
            "pm2_5": round(pm25, 2),
            "pm10": round(comp.get("pm10", 0), 2),
            "no2": round(comp.get("no2", 0), 2),
            "o3": round(comp.get("o3", 0), 2),
            "co": round(comp.get("co", 0), 2),
            "source": "OpenWeatherMap (Live)",
        }
    except Exception as e:
        print(f"[RealAPI] AQI fetch failed: {e}")
        return None


def get_real_aqi_for_sensors(sensor_locations: list) -> Dict[str, Dict]:
    """
    Fetches real AQI for multiple sensor locations.
    Returns dict: { sensor_id -> aqi_data }
    """
    results = {}
    for sensor in sensor_locations:
        data = get_real_aqi(sensor["lat"], sensor["lng"])
        if data:
            results[sensor["id"]] = data
    return results


# ─────────────────────────────────────────────
# 2. OPENWEATHERMAP — REAL RAINFALL DATA
# (Used to make Flood sensors semi-real)
# ─────────────────────────────────────────────

def get_real_rainfall(lat: float, lng: float) -> Optional[float]:
    """
    Fetches current rainfall in mm/hr from OpenWeatherMap.
    Used to override the flood sensor simulation with real weather.
    """
    if not OPENWEATHER_KEY:
        return None
    
    try:
        r = requests.get(
            f"{OWM_BASE}/data/2.5/weather",
            params={"lat": lat, "lon": lng, "appid": OPENWEATHER_KEY, "units": "metric"},
            timeout=5
        )
        r.raise_for_status()
        data = r.json()
        
        # rain.1h = rainfall in last 1 hour (mm)
        rain_mm = data.get("rain", {}).get("1h", 0.0)
        return float(rain_mm)
    except Exception as e:
        print(f"[RealAPI] Rainfall fetch failed: {e}")
        return None


# ─────────────────────────────────────────────
# 3. OSRM — REAL ROAD ROUTING & ETA
# (No API key needed! Uses free demo server)
# ─────────────────────────────────────────────

def get_real_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> Optional[Dict]:
    """
    Gets a real driving route and ETA using OSRM (Open Source Routing Machine).
    Uses the free public demo server — no API key needed.
    
    In production, self-host OSRM for no rate limits.
    
    Returns: { polyline: [[lat,lng],...], eta_minutes: int, distance_km: float }
    """
    try:
        # OSRM expects lng,lat order
        url = f"{OSRM_BASE}/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"
        r = requests.get(
            url,
            params={
                "overview": "full",
                "geometries": "geojson",
                "steps": "false",
            },
            timeout=15
        )
        r.raise_for_status()
        data = r.json()
        
        if data.get("code") != "Ok" or not data.get("routes"):
            return None
        
        route = data["routes"][0]
        duration_sec = route["duration"]
        distance_m = route["distance"]
        
        # GeoJSON coords are [lng, lat] — swap to [lat, lng] for Leaflet
        geojson_coords = route["geometry"]["coordinates"]
        polyline = [[c[1], c[0]] for c in geojson_coords]
        
        return {
            "polyline": polyline,
            "eta_minutes": max(2, int(duration_sec / 60)),
            "distance_km": round(distance_m / 1000, 2),
            "traffic_condition": "Live OSRM routing",
            "source": "OSRM (Real Road Network)",
        }
    except Exception as e:
        print(f"[RealAPI] OSRM routing failed: {e}")
        return None


# ─────────────────────────────────────────────
# 4. OSM OVERPASS — REAL HOSPITAL LOCATIONS
# (No API key needed!)
# ─────────────────────────────────────────────

def get_real_hospitals_indore() -> Optional[list]:
    """
    Fetches real hospital locations in Indore from OpenStreetMap via Overpass API.
    No API key needed. Returns real lat/lng for up to 20 hospitals.
    """
    query = """
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](22.60,75.78,22.80,75.96);
      way["amenity"="hospital"](22.60,75.78,22.80,75.96);
    );
    out center 20;
    """
    try:
        r = requests.post(OVERPASS_BASE, data={"data": query}, timeout=15)
        r.raise_for_status()
        data = r.json()
        
        hospitals = []
        for elem in data.get("elements", []):
            tags = elem.get("tags", {})
            name = tags.get("name") or tags.get("name:en") or "Unknown Hospital"
            
            # Get coordinates (center for ways, direct for nodes)
            if elem["type"] == "node":
                lat, lng = elem["lat"], elem["lon"]
            elif elem["type"] == "way" and "center" in elem:
                lat, lng = elem["center"]["lat"], elem["center"]["lon"]
            else:
                continue
            
            hospitals.append({
                "name": name,
                "lat": lat,
                "lng": lng,
                "phone": tags.get("phone", tags.get("contact:phone", "NA")),
                "emergency": tags.get("emergency", "yes"),
                "source": "OpenStreetMap (Real)",
            })
        
        return hospitals if hospitals else None
    except Exception as e:
        print(f"[RealAPI] Overpass hospital fetch failed: {e}")
        return None


# ─────────────────────────────────────────────
# HEALTH CHECK — tells caller what's live vs simulated
# ─────────────────────────────────────────────

def get_api_health() -> Dict:
    owm_live = bool(OPENWEATHER_KEY)
    return {
        "openweathermap_aqi": {"live": owm_live, "note": "Set OPENWEATHER_API_KEY in .env"},
        "openweathermap_rainfall": {"live": owm_live, "note": "Same key as AQI"},
        "osrm_routing": {"live": True, "note": "No key required — uses OSRM demo server"},
        "osm_hospitals": {"live": True, "note": "No key required — uses Overpass API"},
        "nominatim_geocoding": {"live": True, "note": "Already active in main.py"},
        "hospital_bed_counts": {"live": False, "note": "NHA ABDM requires Govt registration"},
        "cwc_river_levels": {"live": False, "note": "No public REST API — using rainfall as proxy"},
        "vahan_vehicle_db": {"live": False, "note": "Requires NIC registration"},
        "police_crime_data": {"live": False, "note": "Not a public API in India"},
    }
