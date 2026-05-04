"""
🚌 NagarYatra — Smart Transit Engine
NagarIQ Smart City OS

Architecture:
  - Simulates 8 iBus city buses on Indore's BRTS routes
  - Each bus has a live GPS position that updates every 10s
  - Calculates real-time ETA to the nearest stops
  - Manages NagarPass digital ticketing (QR-code based)
"""

import asyncio
import datetime
import random
import uuid
from typing import List, Dict

# ─────────────────────────────────────────────
# ROUTE DEFINITIONS (Indore BRTS Corridors)
# ─────────────────────────────────────────────

BUS_ROUTES = {
    "ROUTE-1": {
        "name": "Rajwada ↔ Vijay Nagar",
        "color": "#3b82f6",  # Blue
        "stops": [
            {"id": "S-01", "name": "Rajwada Chowk",      "lat": 22.7185, "lng": 75.8559},
            {"id": "S-02", "name": "Palasia Square",       "lat": 22.7244, "lng": 75.8839},
            {"id": "S-03", "name": "LIG Square",           "lat": 22.7316, "lng": 75.8900},
            {"id": "S-04", "name": "Vijay Nagar Square",   "lat": 22.7533, "lng": 75.8937},
        ]
    },
    "ROUTE-2": {
        "name": "Airport ↔ Rau",
        "color": "#10b981",  # Green
        "stops": [
            {"id": "S-05", "name": "Devi Ahilya Airport", "lat": 22.7219, "lng": 75.8007},
            {"id": "S-06", "name": "Bhanwarkuan",          "lat": 22.6917, "lng": 75.8672},
            {"id": "S-07", "name": "Bengali Square",       "lat": 22.7111, "lng": 75.8790},
            {"id": "S-08", "name": "Rau",                  "lat": 22.6548, "lng": 75.8200},
        ]
    },
    "ROUTE-3": {
        "name": "Sapna Sangeeta ↔ Bhawarkuan",
        "color": "#f59e0b",  # Amber
        "stops": [
            {"id": "S-09", "name": "Sapna Sangeeta",       "lat": 22.7332, "lng": 75.8800},
            {"id": "S-10", "name": "Treasure Island",      "lat": 22.7291, "lng": 75.8869},
            {"id": "S-11", "name": "Bhawarkuan Square",    "lat": 22.6961, "lng": 75.8671},
        ]
    }
}

# ─────────────────────────────────────────────
# BUS FLEET SIMULATION STATE
# ─────────────────────────────────────────────

_buses: Dict[str, dict] = {
    "BUS-101": {"id": "BUS-101", "route": "ROUTE-1", "stop_index": 0, "direction": 1, "occupancy": 45, "capacity": 60,  "lat": 22.7185, "lng": 75.8559, "speed_kmh": 28},
    "BUS-102": {"id": "BUS-102", "route": "ROUTE-1", "stop_index": 2, "direction": -1, "occupancy": 12, "capacity": 60, "lat": 22.7316, "lng": 75.8900, "speed_kmh": 32},
    "BUS-201": {"id": "BUS-201", "route": "ROUTE-2", "stop_index": 1, "direction": 1,  "occupancy": 30, "capacity": 50, "lat": 22.6917, "lng": 75.8672, "speed_kmh": 22},
    "BUS-202": {"id": "BUS-202", "route": "ROUTE-2", "stop_index": 3, "direction": -1, "occupancy": 8,  "capacity": 50, "lat": 22.6548, "lng": 75.8200, "speed_kmh": 35},
    "BUS-301": {"id": "BUS-301", "route": "ROUTE-3", "stop_index": 0, "direction": 1,  "occupancy": 55, "capacity": 60, "lat": 22.7332, "lng": 75.8800, "speed_kmh": 18},
    "BUS-302": {"id": "BUS-302", "route": "ROUTE-3", "stop_index": 2, "direction": -1, "occupancy": 22, "capacity": 60, "lat": 22.6961, "lng": 75.8671, "speed_kmh": 30},
}

# NagarPass Digital Tickets in-memory store
_tickets: Dict[str, dict] = {}

# ─────────────────────────────────────────────
# SIMULATION LOGIC
# ─────────────────────────────────────────────

def _simulate_bus_movement():
    """Move each bus slightly toward the next stop on its route."""
    for bus_id, bus in _buses.items():
        route = BUS_ROUTES[bus["route"]]
        stops = route["stops"]
        current_stop_idx = bus["stop_index"]
        target_stop_idx = current_stop_idx + bus["direction"]

        # Bounce at route ends
        if target_stop_idx >= len(stops) or target_stop_idx < 0:
            bus["direction"] *= -1
            target_stop_idx = current_stop_idx + bus["direction"]

        target = stops[target_stop_idx]

        # Interpolate 15% of the way toward the next stop each tick
        bus["lat"] = bus["lat"] + (target["lat"] - bus["lat"]) * 0.20
        bus["lng"] = bus["lng"] + (target["lng"] - bus["lng"]) * 0.20

        # If within 0.001 degrees (~100m), snap to next stop
        if abs(bus["lat"] - target["lat"]) < 0.0008 and abs(bus["lng"] - target["lng"]) < 0.0008:
            bus["stop_index"] = target_stop_idx

        # Fluctuate occupancy
        bus["occupancy"] = max(0, min(bus["capacity"], bus["occupancy"] + random.randint(-3, 5)))
        bus["speed_kmh"] = random.randint(15, 45)

def _get_next_stop_info(bus: dict) -> dict:
    """Calculate ETA to the next stop."""
    route = BUS_ROUTES[bus["route"]]
    stops = route["stops"]
    next_idx = bus["stop_index"] + bus["direction"]
    next_idx = max(0, min(len(stops) - 1, next_idx))
    next_stop = stops[next_idx]

    # Simple distance-based ETA
    dlat = next_stop["lat"] - bus["lat"]
    dlng = next_stop["lng"] - bus["lng"]
    dist_km = ((dlat**2 + dlng**2) ** 0.5) * 111
    speed = max(5, bus["speed_kmh"])
    eta_minutes = max(1, int((dist_km / speed) * 60))

    return {
        "next_stop_name": next_stop["name"],
        "eta_minutes": eta_minutes,
    }

def get_all_buses() -> List[dict]:
    """Return all buses with live state for dispatcher map."""
    result = []
    for bus in _buses.values():
        route_info = BUS_ROUTES[bus["route"]]
        next_stop = _get_next_stop_info(bus)
        result.append({
            **bus,
            "route_name": route_info["name"],
            "route_color": route_info["color"],
            "occupancy_pct": int((bus["occupancy"] / bus["capacity"]) * 100),
            **next_stop,
            "timestamp": datetime.datetime.now().isoformat()
        })
    return result

def get_all_stops() -> List[dict]:
    """Return all bus stops across all routes."""
    stops = []
    for route_id, route in BUS_ROUTES.items():
        for stop in route["stops"]:
            stops.append({**stop, "route_id": route_id, "route_name": route["name"], "route_color": route["color"]})
    return stops

def get_buses_near_stop(stop_id: str) -> List[dict]:
    """Get buses approaching a specific stop."""
    all_stops_flat = {s["id"]: s for r in BUS_ROUTES.values() for s in r["stops"]}
    if stop_id not in all_stops_flat:
        return []
    target = all_stops_flat[stop_id]
    buses = get_all_buses()
    # Sort by ETA
    return sorted([b for b in buses if b["next_stop_name"] == target["name"]], key=lambda b: b["eta_minutes"])


# ─────────────────────────────────────────────
# NAGARPASS DIGITAL TICKETING
# ─────────────────────────────────────────────

FARE_TABLE = {
    "ROUTE-1": 15,  # ₹15
    "ROUTE-2": 20,  # ₹20
    "ROUTE-3": 10,  # ₹10
}

def issue_ticket(citizen_id: str, route_id: str, from_stop: str, to_stop: str) -> dict:
    """Issue a NagarPass QR digital ticket."""
    if route_id not in BUS_ROUTES:
        return {"status": "error", "message": "Invalid route"}

    ticket_id = f"NP-{uuid.uuid4().hex[:8].upper()}"
    fare = FARE_TABLE.get(route_id, 15)
    valid_until = (datetime.datetime.now() + datetime.timedelta(hours=2)).isoformat()

    ticket = {
        "ticket_id": ticket_id,
        "citizen_id": citizen_id,
        "route_id": route_id,
        "route_name": BUS_ROUTES[route_id]["name"],
        "from_stop": from_stop,
        "to_stop": to_stop,
        "fare": fare,
        "issued_at": datetime.datetime.now().isoformat(),
        "valid_until": valid_until,
        "status": "active",
        # QR payload: compact JSON that a scanner would decode
        "qr_data": f"NAGARPASS|{ticket_id}|{route_id}|{citizen_id}|{valid_until}",
    }
    _tickets[ticket_id] = ticket
    return {"status": "success", "ticket": ticket}

def validate_ticket(ticket_id: str) -> dict:
    """Validate a ticket at the gate/bus."""
    if ticket_id not in _tickets:
        return {"valid": False, "reason": "Ticket not found"}
    t = _tickets[ticket_id]
    if t["status"] == "used":
        return {"valid": False, "reason": "Ticket already used"}
    if datetime.datetime.fromisoformat(t["valid_until"]) < datetime.datetime.now():
        return {"valid": False, "reason": "Ticket expired"}
    _tickets[ticket_id]["status"] = "used"
    return {"valid": True, "ticket": t}


# ─────────────────────────────────────────────
# BACKGROUND LOOP
# ─────────────────────────────────────────────

async def transit_monitoring_loop():
    """Background task to simulate bus GPS movement every 10 seconds."""
    print("🚌 [NagarYatra] Smart Transit Engine started — 6 buses, 3 routes active...")
    while True:
        _simulate_bus_movement()
        await asyncio.sleep(10)
