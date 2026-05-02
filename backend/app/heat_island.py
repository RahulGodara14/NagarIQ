"""
🌡️ Heat Island Risk Engine — NagarIQ Smart City OS
===================================================
Urban heat mortality alerts during Indore summers.
Simulates temperature and humidity across different micro-climates in Indore
(e.g., concrete junctions vs. parks) to calculate the Heat Index (Perceived Temp).
Generates P1 alerts for vulnerable citizens if heat stress is dangerous.
"""

import asyncio
import datetime
import random
import uuid
from typing import List, Dict
from app import flood_watch # To push incidents

# Typical Indore locations representing different micro-climates
HEAT_ZONES = [
    {"id": "HT-01", "name": "Rajwada (Dense Urban)", "lat": 22.7188, "lng": 75.8560, "type": "CONCRETE_JUNCTION", "base_temp": 42.5},
    {"id": "HT-02", "name": "Palasia (Commercial)", "lat": 22.7244, "lng": 75.8839, "type": "COMMERCIAL", "base_temp": 41.0},
    {"id": "HT-03", "name": "Pipliyapala Regional Park", "lat": 22.6841, "lng": 75.8584, "type": "PARK", "base_temp": 37.5},
    {"id": "HT-04", "name": "Vijay Nagar (Mixed)", "lat": 22.7533, "lng": 75.8937, "type": "MIXED", "base_temp": 40.0},
    {"id": "HT-05", "name": "Bhanwarkuan (Traffic Hub)", "lat": 22.6917, "lng": 75.8672, "type": "TRAFFIC_HUB", "base_temp": 43.0},
]

# Global state
zone_data: Dict[str, dict] = {}
active_alerts: List[dict] = []

def calculate_heat_index(T: float, RH: float) -> float:
    """
    Calculate the Heat Index (Perceived Temperature) in Celsius.
    Using the Rothfusz regression equation.
    T = Temperature in C
    RH = Relative Humidity % (0-100)
    """
    # Convert C to F for the standard formula
    T_F = T * 1.8 + 32
    
    # Simple formula for lower temps
    HI = 0.5 * (T_F + 61.0 + ((T_F - 68.0) * 1.2) + (RH * 0.094))
    
    if HI > 80:
        # Rothfusz full regression
        HI = -42.379 + 2.04901523*T_F + 10.14333127*RH - 0.22475541*T_F*RH \
             - 0.00683783*T_F*T_F - 0.05481717*RH*RH + 0.00122874*T_F*T_F*RH \
             + 0.00085282*T_F*RH*RH - 0.00000199*T_F*T_F*RH*RH
             
    # Convert back to C
    HI_C = (HI - 32) / 1.8
    return round(HI_C, 1)

def _simulate_reading(zone: dict) -> dict:
    """Simulate a reading based on time of day and zone type."""
    hour = datetime.datetime.now().hour
    
    # Simulate diurnal temperature curve (peak at 2 PM / 14:00)
    if 6 <= hour <= 18:
        # Day time heating
        sun_factor = 1 - abs(hour - 14) / 8.0 
    else:
        # Night time cooling
        sun_factor = -0.5
        
    current_temp = zone["base_temp"] + (sun_factor * 4.0) + random.uniform(-0.5, 0.5)
    
    # Urban Heat Island Effect: Concrete cools slower at night
    if zone["type"] in ["CONCRETE_JUNCTION", "TRAFFIC_HUB"] and hour >= 18:
        current_temp += 2.0  # Heat retained
        
    humidity = random.uniform(30, 60) # Typical dry summer humidity, but varies
    
    perceived_temp = calculate_heat_index(current_temp, humidity)
    
    risk_level = "LOW"
    if perceived_temp >= 46.0:
        risk_level = "CRITICAL"
    elif perceived_temp >= 41.0:
        risk_level = "HIGH"
    elif perceived_temp >= 38.0:
        risk_level = "ELEVATED"
        
    return {
        **zone,
        "current_temp_c": round(current_temp, 1),
        "humidity_pct": round(humidity, 1),
        "perceived_temp_c": perceived_temp,
        "risk_level": risk_level,
        "timestamp": datetime.datetime.now().isoformat()
    }

async def heat_monitoring_loop():
    """Background task to monitor heat islands."""
    print("[HeatIsland] 🌡️ Urban Heat Risk Engine started...")
    
    while True:
        global active_alerts
        current_alerts = []
        
        for zone in HEAT_ZONES:
            reading = _simulate_reading(zone)
            zone_data[zone["id"]] = reading
            
            # Check thresholds
            if reading["risk_level"] in ["CRITICAL", "HIGH"]:
                alert = {
                    "zone_id": zone["id"],
                    "zone_name": zone["name"],
                    "severity": reading["risk_level"],
                    "perceived_temp": reading["perceived_temp_c"],
                    "message": f"Heat stroke imminent for vulnerable groups. Sustained perceived temp {reading['perceived_temp_c']}°C."
                }
                current_alerts.append(alert)
                
                # Auto-generate P1 incident for CRITICAL
                if reading["risk_level"] == "CRITICAL" and random.random() > 0.8: # 20% chance to drop incident
                    try:
                        from .database import SessionLocal
                        from . import models
                        db = SessionLocal()
                        incident_id = f"HEAT-{uuid.uuid4().hex[:6].upper()}"
                        
                        incident = models.Incident(
                            id=incident_id,
                            caller_id=0,         # 0 = automated IoT system
                            incident_type="Medical Emergency (Heat Stroke)",
                            description=f"Multiple reports of heat exhaustion. Heat index {reading['perceived_temp_c']}°C.",
                            lat=zone["lat"],
                            lng=zone["lng"],
                            address=f"Near {zone['name']}, Indore",
                            severity="P1",
                            status="active",
                            timestamp=datetime.datetime.utcnow(),
                        )
                        db.add(incident)
                        db.commit()
                        print(f"🚨 [HeatIsland] Auto-created P1 incident {incident_id} at {zone['name']}")
                    except Exception as e:
                        print(f"[HeatIsland] DB Error: {e}")
                    finally:
                        if 'db' in locals():
                            db.close()

        active_alerts = current_alerts
        await asyncio.sleep(15) # Poll every 15s for demo

def get_all_zones() -> List[dict]:
    return list(zone_data.values())

def get_active_alerts() -> List[dict]:
    return active_alerts
