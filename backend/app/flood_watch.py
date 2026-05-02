"""
🌊 Flood Early Warning Engine
NagarIQ IoT Sensor Simulation for Indore Flood Zones

Architecture:
  - Simulates 6 water-level sensors on Indore's flood-prone rivers/drains
  - Runs as an asyncio background loop (FastAPI lifespan)
  - When ANY sensor breaches the critical threshold → auto-creates a P1 incident in DB
  - Exposes live sensor telemetry for dispatcher map overlay
"""

import asyncio
import random
import uuid
import datetime
from typing import Dict, Optional

# ─────────────────────────────────────────────
# SENSOR DEFINITIONS (Static config)
# ─────────────────────────────────────────────

FLOOD_SENSORS = [
    {
        "id": "FLD-01",
        "name": "Khan River @ Rajwada Bridge",
        "zone": "Rajwada",
        "lat": 22.7186, "lng": 75.8559,
        "river": "Khan River",
        "danger_level_m": 5.2,   # Critical flood threshold (meters)
        "warning_level_m": 3.8,  # Orange alert threshold
        "normal_level_m": 1.5,   # Baseline (dry season)
    },
    {
        "id": "FLD-02",
        "name": "Khan River @ MG Road",
        "zone": "Palasia",
        "lat": 22.7221, "lng": 75.8847,
        "river": "Khan River",
        "danger_level_m": 4.8,
        "warning_level_m": 3.5,
        "normal_level_m": 1.2,
    },
    {
        "id": "FLD-03",
        "name": "Saraswati Nala @ Bhawarkuan",
        "zone": "Bhawarkuan",
        "lat": 22.6961, "lng": 75.8671,
        "river": "Saraswati Nala",
        "danger_level_m": 3.5,
        "warning_level_m": 2.5,
        "normal_level_m": 0.8,
    },
    {
        "id": "FLD-04",
        "name": "Gambhir River @ Kanadia Road",
        "zone": "Kanadia",
        "lat": 22.7601, "lng": 75.8712,
        "river": "Gambhir River",
        "danger_level_m": 4.0,
        "warning_level_m": 2.8,
        "normal_level_m": 1.0,
    },
    {
        "id": "FLD-05",
        "name": "Choral Nala @ Ring Road",
        "zone": "Betma Road",
        "lat": 22.6831, "lng": 75.8290,
        "river": "Choral Nala",
        "danger_level_m": 3.2,
        "warning_level_m": 2.2,
        "normal_level_m": 0.6,
    },
    {
        "id": "FLD-06",
        "name": "Sirpur Lake Overflow",
        "zone": "Sirpur",
        "lat": 22.7451, "lng": 75.9057,
        "river": "Sirpur Lake",
        "danger_level_m": 6.5,
        "warning_level_m": 5.0,
        "normal_level_m": 3.2,
    },
]

# ─────────────────────────────────────────────
# LIVE SENSOR STATE (updated by background loop)
# ─────────────────────────────────────────────

sensor_state: Dict[str, dict] = {
    s["id"]: {
        **s,
        "current_level_m": s["normal_level_m"],
        "alert_status": "NORMAL",
        "trend": "stable",
        "last_updated": datetime.datetime.utcnow().isoformat(),
        "rainfall_mm_hr": 0.0,
    }
    for s in FLOOD_SENSORS
}

# Track which sensors have already triggered a DB incident (avoid duplicates per flood event)
triggered_incidents: Dict[str, str] = {}  # sensor_id → incident_id

# ─────────────────────────────────────────────
# SENSOR SIMULATION LOGIC
# ─────────────────────────────────────────────

def simulate_sensor_tick(sensor_id: str) -> dict:
    """
    Advance one sensor's water level:
    - Most ticks: small fluctuation (±0.05m)
    - 15% chance: rainfall spike (+0.3 to +1.2m)  — simulates monsoon burst
    - 5% chance: gradual drain (-0.1 to -0.3m)    — simulates water receding
    """
    s = sensor_state[sensor_id]
    base = s["current_level_m"]

    roll = random.random()
    if roll < 0.05:
        # Drain
        delta = random.uniform(-0.3, -0.1)
        trend = "falling"
        rainfall = max(0.0, s["rainfall_mm_hr"] - random.uniform(5, 15))
    elif roll < 0.20:
        # Rainfall spike
        delta = random.uniform(0.3, 1.5)
        trend = "rising fast"
        rainfall = random.uniform(30, 90)
    else:
        # Normal fluctuation
        delta = random.uniform(-0.08, 0.12)
        trend = "rising" if delta > 0 else "stable"
        rainfall = max(0.0, s["rainfall_mm_hr"] + random.uniform(-3, 5))

    new_level = max(0.1, min(base + delta, s["danger_level_m"] * 1.4))
    rainfall = min(rainfall, 150.0)

    # Determine alert status
    if new_level >= s["danger_level_m"]:
        alert_status = "CRITICAL"
    elif new_level >= s["warning_level_m"]:
        alert_status = "WARNING"
    else:
        alert_status = "NORMAL"

    # Update state
    sensor_state[sensor_id].update({
        "current_level_m": round(new_level, 2),
        "alert_status": alert_status,
        "trend": trend,
        "rainfall_mm_hr": round(rainfall, 1),
        "last_updated": datetime.datetime.utcnow().isoformat(),
    })

    return sensor_state[sensor_id]


def create_flood_incident(sensor: dict, db_session_factory) -> Optional[str]:
    """
    Auto-creates a P1 Flood Emergency incident in the NagarIQ database.
    Called when a sensor crosses CRITICAL threshold for the first time in a flood event.
    """
    from .database import SessionLocal
    from . import models

    db = SessionLocal()
    try:
        incident_id = f"FLD-{uuid.uuid4().hex[:8].upper()}"
        level = sensor["current_level_m"]
        danger = sensor["danger_level_m"]
        excess_pct = int(((level - danger) / danger) * 100)

        description = (
            f"🌊 AUTO-ALERT (IoT Sensor {sensor['id']}): "
            f"Critical flood level detected at {sensor['name']}. "
            f"Current water level: {level:.2f}m — {excess_pct}% above danger threshold ({danger}m). "
            f"Rainfall: {sensor['rainfall_mm_hr']}mm/hr. "
            f"Immediate evacuation of {sensor['zone']} area recommended."
        )

        incident = models.Incident(
            id=incident_id,
            caller_id=0,         # 0 = automated IoT system
            incident_type="Flood Emergency",
            description=description,
            lat=sensor["lat"],
            lng=sensor["lng"],
            address=f"{sensor['name']}, {sensor['zone']}, Indore",
            severity="P1",
            status="active",
            timestamp=datetime.datetime.utcnow(),
        )
        db.add(incident)
        db.commit()
        print(f"🚨 [FloodWatch] Auto-created P1 incident {incident_id} for sensor {sensor['id']}")
        return incident_id
    except Exception as e:
        print(f"[FloodWatch] DB error: {e}")
        db.rollback()
        return None
    finally:
        db.close()


def clear_triggered_sensor(sensor_id: str):
    """Clear the triggered flag when a sensor drops back to normal."""
    if sensor_id in triggered_incidents:
        print(f"🌿 [FloodWatch] Sensor {sensor_id} returned to safe levels. Clearing alert.")
        del triggered_incidents[sensor_id]


# ─────────────────────────────────────────────
# BACKGROUND MONITORING LOOP
# ─────────────────────────────────────────────

async def flood_monitoring_loop():
    """
    Runs every 20 seconds as a FastAPI lifespan background task.
    Ticks all sensors and auto-escalates critical ones to P1 incidents.
    """
    print("🌊 [FloodWatch] IoT Sensor Network online — monitoring 6 Indore flood zones...")
    while True:
        await asyncio.sleep(20)  # Poll every 20 seconds

        for sid in sensor_state:
            updated = simulate_sensor_tick(sid)

            if updated["alert_status"] == "CRITICAL":
                if sid not in triggered_incidents:
                    # First time crossing CRITICAL — fire auto-incident
                    inc_id = create_flood_incident(updated, None)
                    if inc_id:
                        triggered_incidents[sid] = inc_id
            else:
                # Sensor back to safe → clear the trigger so next event fires fresh
                if updated["alert_status"] == "NORMAL" and sid in triggered_incidents:
                    clear_triggered_sensor(sid)


def get_all_sensor_states() -> list:
    """Returns live telemetry for all sensors (for API endpoint)."""
    return list(sensor_state.values())
