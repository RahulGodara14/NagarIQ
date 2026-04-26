from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
import torch.nn as nn
import numpy as np
from typing import Optional, List, Dict, Set
from pydantic import BaseModel
from sqlalchemy.orm import Session
import datetime
import uuid
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import requests
from geopy.geocoders import Nominatim
import asyncio
from contextlib import asynccontextmanager
from . import models, auth
from .database import engine, get_db
from fastapi.middleware.cors import CORSMiddleware
import base64
import random
from . import models, auth, protocols, anpr
from app import flood_watch
from app import jal_shakti   # ← Jal Shakti Water Monitoring
from app import real_apis  # ← Live API integrations
from app import face_trace  # ← FaceTrace missing person engine
from app import challan_dispute  # ← AI Challan Dispute Engine
from app import nagar_seva # ← NagarSeva Volunteers
from app import heat_island # ← Heat Island Risk Engine
from app import nagar_score # ← NagarScore Gamification
from app import nagar_yatra # ← NagarYatra Smart Transit
from app import nagar_khata # ← NagarKhata Municipal Billing


# Create database tables
models.Base.metadata.create_all(bind=engine)

# ─────────────────────────────────────────────
# LIFESPAN: Start IoT Background Tasks
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app):
    # Start background IoT monitoring loops
    flood_task = asyncio.create_task(flood_watch.flood_monitoring_loop())
    jal_task = asyncio.create_task(jal_shakti.water_monitoring_loop())
    heat_task = asyncio.create_task(heat_island.heat_monitoring_loop())
    transit_task = asyncio.create_task(nagar_yatra.transit_monitoring_loop())
    
    yield
    
    # Clean up on shutdown
    flood_task.cancel()
    jal_task.cancel()
    heat_task.cancel()
    transit_task.cancel()
    for task in [flood_task, jal_task, heat_task, transit_task]:
        try:
            await task
        except asyncio.CancelledError:
            pass

app = FastAPI(title="NagarIQ Backend", version="1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
geolocator = Nominatim(user_agent="nagariq_smart_city_os")

# ==========================================
# NAGRIK-DRISHTI: LIVE VIDEO RELAY HUB
# ==========================================
# { incident_id: { "streamer": WebSocket | None, "viewers": Set[WebSocket] } }
drishti_rooms: Dict[str, dict] = {}

async def relay_frame(incident_id: str, frame_data: str):
    """Broadcast a base64 frame to all dispatchers watching this incident."""
    room = drishti_rooms.get(incident_id)
    if not room:
        return
    dead = set()
    for viewer in room["viewers"]:
        try:
            await viewer.send_text(frame_data)
        except Exception:
            dead.add(viewer)
    room["viewers"] -= dead

@app.websocket("/ws/drishti/{incident_id}/stream")
async def drishti_streamer(websocket: WebSocket, incident_id: str):
    """Citizen connects here to push live frames."""
    await websocket.accept()
    if incident_id not in drishti_rooms:
        drishti_rooms[incident_id] = {"streamer": None, "viewers": set()}
    drishti_rooms[incident_id]["streamer"] = websocket
    print(f"[Nagrik-Drishti] 🔴 Citizen streaming started for incident: {incident_id}")
    try:
        while True:
            frame = await websocket.receive_text()  # base64 JPEG frames
            await relay_frame(incident_id, frame)
    except WebSocketDisconnect:
        print(f"[Nagrik-Drishti] Streamer disconnected: {incident_id}")
        if incident_id in drishti_rooms:
            drishti_rooms[incident_id]["streamer"] = None
            # Notify all viewers that the stream ended
            for viewer in drishti_rooms[incident_id]["viewers"]:
                try:
                    await viewer.send_text("STREAM_ENDED")
                except Exception:
                    pass

@app.websocket("/ws/drishti/{incident_id}/view")
async def drishti_viewer(websocket: WebSocket, incident_id: str):
    """Dispatcher connects here to watch the live feed."""
    await websocket.accept()
    if incident_id not in drishti_rooms:
        drishti_rooms[incident_id] = {"streamer": None, "viewers": set()}
    drishti_rooms[incident_id]["viewers"].add(websocket)
    print(f"[Nagrik-Drishti] 👁 Dispatcher watching: {incident_id}")
    try:
        while True:
            await websocket.receive_text()  # Keep-alive ping from client
    except WebSocketDisconnect:
        print(f"[Nagrik-Drishti] Viewer disconnected: {incident_id}")
        if incident_id in drishti_rooms:
            drishti_rooms[incident_id]["viewers"].discard(websocket)

@app.get("/api/v1/drishti/{incident_id}/status")
def get_drishti_status(incident_id: str):
    """Check if a live stream is active for a given incident."""
    room = drishti_rooms.get(incident_id)
    is_live = room is not None and room.get("streamer") is not None
    viewer_count = len(room["viewers"]) if room else 0
    return {"incident_id": incident_id, "is_live": is_live, "viewer_count": viewer_count}


def reverse_geocode(lat: float, lng: float) -> str:
    """Translates raw GPS coordinates into a real street address."""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json"
        # OpenStreetMap requires a User-Agent header so they know who is pinging them
        headers = {'User-Agent': 'NagarIQ-SmartCity-Project'}
        response = requests.get(url, headers=headers, timeout=5).json()
        return response.get("display_name", f"Lat: {lat}, Lng: {lng}")
    except Exception:
        # Fallback just in case the internet is slow
        return f"Lat: {lat}, Lng: {lng}"
# ==========================================
# 1. LOAD THE AI MODEL INTO MEMORY
# ==========================================
print("Loading NagarIQ Production Model into memory...")
try:
    model_path = "./model"
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    classification_model = AutoModelForSequenceClassification.from_pretrained(model_path)
    print("AI Model successfully initialized!")
except Exception as e:
    print(f"Warning: AI Model not found at ./model. Error: {e}")

# The exact categories we trained on
EMERGENCY_CATEGORIES = [
    "Medical", "Road Accident", "Fire", "Crime/Assault", 
    "Natural Disaster", "Domestic Violence", "Missing Person", "Infrastructure Failure"
]

# ==========================================
# 2. UPDATED SOS REQUEST SCHEMA
# ==========================================
class SOSRequest(BaseModel):
    lat: float
    lng: float
    channel: str 
    description: str = ""  # Optional — user may only send a photo
    image: str = None 

@app.get("/")
def read_root():
    return {"message": "NagarIQ Smart City OS is online. AI Engine connected."}

# ==========================================
# 3. THE INTELLIGENT SOS ENDPOINT
# ==========================================
@app.post("/api/v1/sos")
def trigger_sos(
    incident: SOSRequest, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(auth.get_current_user)
):
    # 1. Reverse Geocode the coordinates
    try:
        location = geolocator.reverse(f"{incident.lat}, {incident.lng}")
        address = location.address if location else "Unknown Location"
    except:
        address = "Geocoding Unavailable"

    # 2. Run the AI Classification Engine
    try:
        # Use description if provided, otherwise use a default for the model
        text_for_ai = incident.description.strip() if incident.description.strip() else "Emergency reported via app"
        inputs = tokenizer(text_for_ai, return_tensors="pt", truncation=True, padding=True, max_length=128)
        
        # Ask the model to predict without training (saves RAM)
        with torch.no_grad():
            outputs = classification_model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1)
            predicted_id = torch.argmax(probabilities, dim=-1).item()
            
        ai_classification = EMERGENCY_CATEGORIES[predicted_id]
        confidence_score = round(probabilities[0][predicted_id].item() * 100, 2)
        
    except Exception as e:
        ai_classification = "Classification Failed"
        confidence_score = 0.0
        print(f"AI Error: {e}")

    # 3. Generate Incident ID and save to PostgreSQL
    incident_id = f"INC-{str(uuid.uuid4())[:8].upper()}"
    
    # 4. Get Protocol
    protocol = protocols.get_protocol(ai_classification)
    
    new_incident = models.Incident(
        id=incident_id,
        caller_id=current_user["user_id"],
        incident_type=ai_classification,
        description=incident.description,
        lat=incident.lat,
        lng=incident.lng,
        address=address,
        image_data=incident.image,
        severity=protocol["severity"], # <--- New: Severity from Protocol
        timestamp=datetime.datetime.utcnow()
    )
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)
    
    return {
        "status": "success", 
        "incident_id": new_incident.id, 
        "ai_prediction": ai_classification,
        "confidence": f"{confidence_score}%",
        "address_detected": address,
        "protocol": protocol, # <--- New: The "Protocol Intelligence" Layer
        "message": "Intelligent SOS securely logged and classified."
    }
# Define what the Traffic Camera will send us
class TrafficViolation(BaseModel):
    vehicle_number: str
    lat: float
    lng: float
    image_base64: str = None

@app.post("/api/v1/traffic/violation")
def report_traffic_violation(violation: TrafficViolation, db: Session = Depends(get_db)):
    # Generate a unique Traffic ID
    incident_id = f"TRF-{uuid.uuid4().hex[:8].upper()}"
    
    # Figure out the street name from the camera's GPS
    address = reverse_geocode(violation.lat, violation.lng)
    
    new_incident = models.Incident(
        id=incident_id,
        caller_id=0, # 0 means "Automated System"
        incident_type="Traffic Violation",
        description=f"Automated Speeding E-Challan issued for vehicle: {violation.vehicle_number}",
        lat=violation.lat,
        lng=violation.lng,
        address=address,
        image_data=violation.image_base64,
        timestamp=datetime.datetime.utcnow(),
        severity="P2"
    )
    
    db.add(new_incident)
    db.commit()
    
    return {"status": "success", "incident_id": incident_id}

class VoiceSOSRequest(BaseModel):
    lat: float
    lng: float
    audioBase64: str

@app.post("/api/v1/sos/voice")
def trigger_voice_sos(
    req: VoiceSOSRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user)
):
    """
    Tier 1 Feature: Multilingual Voice SOS (Hindi/Malvi)
    Uses simulated OpenAI Whisper architecture to transcribe field audio.
    """
    print("🎙️ Whisper AI: Analyzing voice distress signal...")
    
    # Mocking standard Hindi/Malvi transliterated distress phrases as if translated by Whisper
    mock_transcriptions = [
        "Bhaiya Bhawarkuan square ke paas factory mein bhayankar aag lag gayi hai, jaldi fire brigade bhejo!",
        "Palasia square pe ek car auto se takra gayi hai bahut jor se, accident ho gaya hai.",
        "Vijay Nagar thane ke paas ladai ho rahi hai, kuch log hathyaron ke sath dusro ko maar rahe hain."
    ]
    transcription = random.choice(mock_transcriptions)
    print(f"🎙️ Whisper AI Transcription: '{transcription}'")
    
    # Trigger the primary NLP AI SOS Endpoint
    sos_req = SOSRequest(
        lat=req.lat,
        lng=req.lng,
        channel="Voice-SOS (Whisper AI)",
        description=transcription
    )
    
    response = trigger_sos(sos_req, db, current_user)
    response["description"] = transcription
    return response

import math
class AQICheckRequest(BaseModel):
    lat: float
    lng: float

def haversine_distance(lat1, lon1, lat2, lon2):
    p = 0.017453292519943295
    a = 0.5 - math.cos((lat2 - lat1) * p)/2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742 * math.asin(math.sqrt(a))

@app.post("/api/v1/environment/aqi/check")
def check_hyperlocal_aqi(req: AQICheckRequest, current_user: dict = Depends(auth.get_current_user)):
    """
    Hyper-local AQI check. Uses OpenWeatherMap API if key is set, else falls back to simulation.
    """
    # --- REAL: Try OpenWeatherMap first ---
    real_data = real_apis.get_real_aqi(req.lat, req.lng)
    if real_data:
        aqi = real_data["aqi"]
        location = reverse_geocode(req.lat, req.lng).split(",")[0]
        threshold = 50
        if aqi > threshold:
            return {
                "status": "alert",
                "message": f"⚠️ Real-Time AQI Alert near {location}: AQI is {aqi} ({real_data['label']}). PM2.5: {real_data['pm2_5']}μg/m³. Wear an N95 mask and avoid outdoor activity.",
                "aqi": aqi,
                "location": location,
                "source": real_data["source"],
                "pm2_5": real_data["pm2_5"],
                "pm10": real_data["pm10"],
            }
        return {
            "status": "safe",
            "message": f"Air quality is {real_data['label']} near {location}. AQI: {aqi}.",
            "aqi": aqi,
            "location": location,
            "source": real_data["source"],
        }

    # --- FALLBACK: Simulated sensors (when no API key) ---
    aqi_sensors = [
        {"id": "VAYU-01", "location": "Palasia Square", "lat": 22.7225, "lng": 75.8850, "aqi": random.randint(40, 80)},
        {"id": "VAYU-02", "location": "Rajwada", "lat": 22.7180, "lng": 75.8540, "aqi": random.randint(120, 160)},
        {"id": "VAYU-03", "location": "Bhawarkuan", "lat": 22.6950, "lng": 75.8680, "aqi": random.randint(150, 210)},
        {"id": "VAYU-04", "location": "Vijay Nagar", "lat": 22.7530, "lng": 75.8930, "aqi": random.randint(300, 400)},
        {"id": "VAYU-05", "location": "Pithampur Industrial", "lat": 22.6150, "lng": 75.6800, "aqi": random.randint(250, 350)}
    ]
    nearest = min(aqi_sensors, key=lambda s: haversine_distance(req.lat, req.lng, s["lat"], s["lng"]))
    if nearest["aqi"] > 0:
        return {
            "status": "alert",
            "message": f"[Simulated] AQI at {nearest['location']} is {nearest['aqi']}. Set OPENWEATHER_API_KEY in .env for live data.",
            "aqi": nearest["aqi"],
            "location": nearest["location"],
            "source": "Simulated (no API key)"
        }
    return {"status": "safe", "message": f"Air quality safe near {nearest['location']}.", "aqi": nearest["aqi"], "location": nearest["location"], "source": "Simulated"}

# --- NEW MOCK NOTIFICATION ENDPOINTS ---
@app.get("/api/v1/nagrik/notifications")
def get_notifications(current_user: dict = Depends(auth.get_current_user)):
    return {"status": "success", "notifications": []}

@app.post("/api/v1/nagrik/notifications/clear")
def clear_notifications(current_user: dict = Depends(auth.get_current_user)):
    return {"status": "success"}

# --- NEW ANALYTICS ENDPOINT (RANDOM FOREST) ---
from app import analytics
from app import aria as aria_engine
import datetime

@app.get("/api/v1/analytics/hotspots")
def get_predictive_hotspots():
    """
    Tier 1 Feature: AI Predictive Heatmap
    Runs the Random Forest model for the current hour/day to predict where incidents will occur next!
    """
    now = datetime.datetime.now()
    hour = now.hour
    day = now.weekday()
    
    predictions = analytics.get_hotspot_grid(hour, day)
    return {"status": "success", "predictions": predictions, "timestamp": str(now)}


# --- ARIA AI CO-PILOT ENDPOINT ---
class ARIAChatRequest(BaseModel):
    message: str

@app.post("/api/v1/aria/chat")
def aria_chat(req: ARIAChatRequest, db: Session = Depends(get_db)):
    """
    Tier 1 Feature: ARIA — Adaptive Response Intelligence Assistant
    LangChain-style tool-use pipeline that answers dispatcher queries using live DB data.
    """
    # Pull live system state for ARIA to reason over
    incidents_raw = db.query(models.Incident).order_by(models.Incident.timestamp.desc()).limit(50).all()
    incidents = [
        {
            "id": inc.id,
            "incident_type": inc.incident_type,
            "description": inc.description,
            "lat": inc.lat,
            "lng": inc.lng,
            "address": inc.address,
            "severity": inc.severity,
            "status": inc.status,
        }
        for inc in incidents_raw
    ]

    result = aria_engine.aria_respond(
        message=req.message,
        incidents=incidents,
        units=AMBULANCE_UNITS,
    )
    return {"status": "success", **result}


# --- NEW: ADAPTIVE EMERGENCY ROUTING (Ambulance Units) ---
AMBULANCE_UNITS = [
    {"id": "Amb-01", "name": "Indore-City-Medic", "lat": 22.7126, "lng": 75.8777, "status": "idle"},
    {"id": "Amb-02", "name": "Rajwada-Emergency", "lat": 22.7180, "lng": 75.8540, "status": "idle"},
    {"id": "Amb-03", "name": "VijayNagar-Rescuers", "lat": 22.7530, "lng": 75.8930, "status": "idle"},
    {"id": "Amb-04", "name": "Palasia-FirstResponse", "lat": 22.7225, "lng": 75.8850, "status": "idle"},
]

@app.get("/api/v1/routing/units")
def get_ambulance_units():
    """Returns live locations of all emergency responders."""
    return {"status": "success", "data": AMBULANCE_UNITS}

class UnitUpdateRequest(BaseModel):
    lat: float = None
    lng: float = None
    status: str = None

@app.patch("/api/v1/routing/units/{unit_id}")
def update_unit_location(unit_id: str, update: UnitUpdateRequest):
    for u in AMBULANCE_UNITS:
        if u["id"] == unit_id:
            if update.lat is not None:
                u["lat"] = update.lat
            if update.lng is not None:
                u["lng"] = update.lng
            if update.status is not None:
                u["status"] = update.status
            return {"status": "success"}
    return {"status": "error", "message": "Unit not found"}

@app.get("/api/v1/routing/path")
def get_emergency_path(start_lat: float, start_lng: float, end_lat: float, end_lng: float):
    """
    Emergency path routing. Uses OSRM real road network if available, else simulated path.
    OSRM is completely free with no API key required.
    """
    # --- REAL: Try OSRM first (free, no key needed) ---
    real_route = real_apis.get_real_route(start_lat, start_lng, end_lat, end_lng)
    if real_route:
        return {
            "status": "success",
            **real_route,
        }
    
    # --- FALLBACK: Simulated path ---
    mid_lat = (start_lat + end_lat) / 2
    mid_lng = (start_lng + end_lng) / 2
    path = [
        [start_lat, start_lng],
        [mid_lat + 0.005, start_lng + 0.002],
        [mid_lat, mid_lng],
        [end_lat - 0.005, end_lng - 0.002],
        [end_lat, end_lng]
    ]
    return {
        "status": "success",
        "polyline": path,
        "eta_minutes": random.randint(4, 12),
        "traffic_condition": "Simulated (OSRM unavailable)",
        "distance_km": round(random.uniform(1.5, 5.0), 2),
        "source": "Simulated"
    }

# ─────────────────────────────────────────────────────────────
# 🌊 FLOOD EARLY WARNING — IoT SENSOR TELEMETRY API
# ─────────────────────────────────────────────────────────────

@app.get("/api/v1/flood/sensors")
def get_flood_sensors():
    """
    Returns live telemetry from all 6 Indore flood IoT sensors.
    Water levels are simulated but rainfall data comes from OpenWeatherMap if API key is set.
    """
    sensors = flood_watch.get_all_sensor_states()
    
    # Enrich with real rainfall if OWM key available
    if real_apis.OPENWEATHER_KEY:
        for sensor in sensors:
            real_rain = real_apis.get_real_rainfall(sensor["lat"], sensor["lng"])
            if real_rain is not None:
                # Blend: real rainfall influences the simulation
                sensor["rainfall_mm_hr"] = round(real_rain, 1)
                sensor["rainfall_source"] = "OpenWeatherMap (Live)"
    
    critical_count = sum(1 for s in sensors if s["alert_status"] == "CRITICAL")
    warning_count  = sum(1 for s in sensors if s["alert_status"] == "WARNING")
    return {
        "status": "success",
        "sensors": sensors,
        "summary": {
            "total": len(sensors),
            "critical": critical_count,
            "warning": warning_count,
            "normal": len(sensors) - critical_count - warning_count,
        }
    }

@app.get("/api/v1/system/api-health")
def get_api_health():
    """
    Shows which features are powered by real APIs vs simulation.
    Check this endpoint to know what to configure.
    """
    return {"status": "success", "services": real_apis.get_api_health()}

@app.get("/api/v1/medata/hospitals/osm")
def get_hospitals_from_osm():
    """
    Fetches REAL hospital locations from OpenStreetMap Overpass API.
    No API key required. Returns actual Indore hospitals.
    """
    hospitals = real_apis.get_real_hospitals_indore()
    if hospitals:
        return {"status": "success", "hospitals": hospitals, "source": "OpenStreetMap (Real)"}
    return {"status": "error", "message": "Overpass API unavailable, use /api/v1/medata/hospitals for simulated data"}

# ─────────────────────────────────────────────────────────────
# 🏥 MEDATA: HOSPITAL ROUTING + LIVE BED COUNT
# ─────────────────────────────────────────────────────────────

HOSPITALS_DB = [
    {
        "id": "HOSP-01",
        "name": "MY Hospital (Maharaja Yashwantrao)",
        "short": "MY Hospital",
        "lat": 22.7257, "lng": 75.8681,
        "type": "Government",
        "total_beds": 1200,
        "icu_beds": 80,
        "emergency_beds": 40,
        "phone": "0731-2529500",
        "specialties": ["Trauma", "Cardiac", "Neurology"]
    },
    {
        "id": "HOSP-02",
        "name": "Bombay Hospital Indore",
        "short": "Bombay Hospital",
        "lat": 22.7198, "lng": 75.8785,
        "type": "Private",
        "total_beds": 450,
        "icu_beds": 35,
        "emergency_beds": 20,
        "phone": "0731-2551551",
        "specialties": ["Cardiac", "Orthopedic", "Oncology"]
    },
    {
        "id": "HOSP-03",
        "name": "Choithram Hospital",
        "short": "Choithram",
        "lat": 22.7381, "lng": 75.8897,
        "type": "Private",
        "total_beds": 350,
        "icu_beds": 28,
        "emergency_beds": 15,
        "phone": "0731-2360569",
        "specialties": ["Neurology", "Burns", "General"]
    },
    {
        "id": "HOSP-04",
        "name": "CHL Apollo Hospital",
        "short": "CHL Apollo",
        "lat": 22.7076, "lng": 75.8839,
        "type": "Private",
        "total_beds": 500,
        "icu_beds": 50,
        "emergency_beds": 25,
        "phone": "0731-4777777",
        "specialties": ["Cardiac", "Transplant", "Trauma"]
    },
    {
        "id": "HOSP-05",
        "name": "Arihant Hospital",
        "short": "Arihant",
        "lat": 22.7455, "lng": 75.8910,
        "type": "Private",
        "total_beds": 200,
        "icu_beds": 20,
        "emergency_beds": 10,
        "phone": "0731-2553555",
        "specialties": ["General", "Pediatrics", "Maternity"]
    },
]

def get_live_bed_counts(hospital: dict) -> dict:
    """
    Simulates real-time bed telemetry from hospital HMS systems.
    In production, this would poll the NHA ABDM API or hospital's own API.
    Randomized within realistic ranges to simulate intraday fluctuations.
    """
    import math
    # Simulate occupancy 60-95% for emergency beds
    avail_emergency = max(0, hospital["emergency_beds"] - random.randint(
        int(hospital["emergency_beds"] * 0.55),
        int(hospital["emergency_beds"] * 0.95)
    ))
    avail_icu = max(0, hospital["icu_beds"] - random.randint(
        int(hospital["icu_beds"] * 0.70),
        int(hospital["icu_beds"] * 0.98)
    ))
    occupancy_pct = random.randint(68, 97)

    return {
        **hospital,
        "available_emergency": avail_emergency,
        "available_icu": avail_icu,
        "occupancy_pct": occupancy_pct,
        "can_receive": avail_emergency > 0,
        "status": "CRITICAL" if avail_emergency == 0 else ("BUSY" if avail_emergency <= 3 else "AVAILABLE"),
    }

@app.get("/api/v1/medata/hospitals")
def get_hospitals_with_beds():
    """
    🏥 MedETA: Returns all Indore hospitals with simulated live bed availability.
    Used to render the hospital layer on the dispatcher map.
    """
    hospitals_live = [get_live_bed_counts(h) for h in HOSPITALS_DB]
    return {"status": "success", "hospitals": hospitals_live}

class MedETARouteRequest(BaseModel):
    incident_lat: float
    incident_lng: float
    ambulance_id: str
    patient_condition: Optional[str] = "general"  # "cardiac", "trauma", "burns", "general"

@app.post("/api/v1/medata/route")
def medata_smart_route(req: MedETARouteRequest):
    """
    🏥 MedETA Smart Routing: Find the optimal hospital based on:
      1. Has available emergency beds
      2. Has relevant specialty for the patient condition
      3. Shortest ETA (distance from incident)
    """
    # Get all hospitals with live bed data
    hospitals_live = [get_live_bed_counts(h) for h in HOSPITALS_DB]

    # Filter to hospitals that can actually receive patients
    available = [h for h in hospitals_live if h["can_receive"]]
    if not available:
        # Fallback — send to nearest regardless
        available = hospitals_live

    # Score each hospital: specialty match + bed availability + proximity
    SPECIALTY_MAP = {
        "cardiac": ["Cardiac"],
        "trauma": ["Trauma"],
        "burns": ["Burns"],
        "neuro": ["Neurology"],
        "general": [],
    }
    preferred_specs = SPECIALTY_MAP.get(req.patient_condition, [])

    def score(h):
        dist = haversine_distance(req.incident_lat, req.incident_lng, h["lat"], h["lng"])
        specialty_bonus = 3.0 if any(s in h["specialties"] for s in preferred_specs) else 0.0
        bed_score = h["available_emergency"] * 0.5
        distance_penalty = dist * 2.0
        return specialty_bonus + bed_score - distance_penalty

    ranked = sorted(available, key=score, reverse=True)
    best = ranked[0]

    # Generate routing polyline (ambulance → hospital)
    amb = next((u for u in AMBULANCE_UNITS if u["id"] == req.ambulance_id), AMBULANCE_UNITS[0])
    mid_lat = (amb["lat"] + best["lat"]) / 2
    mid_lng = (amb["lng"] + best["lng"]) / 2
    polyline = [
        [amb["lat"], amb["lng"]],
        [mid_lat + 0.004, amb["lng"] + 0.003],
        [mid_lat, mid_lng],
        [best["lat"] - 0.003, best["lng"] - 0.002],
        [best["lat"], best["lng"]],
    ]
    dist_km = haversine_distance(amb["lat"], amb["lng"], best["lat"], best["lng"])
    eta = max(3, int(dist_km * 3.8))

    return {
        "status": "success",
        "recommended_hospital": {
            "id": best["id"],
            "name": best["name"],
            "short": best["short"],
            "lat": best["lat"],
            "lng": best["lng"],
            "available_emergency": best["available_emergency"],
            "available_icu": best["available_icu"],
            "phone": best["phone"],
            "status": best["status"],
            "specialties": best["specialties"],
        },
        "polyline": polyline,
        "eta_minutes": eta,
        "distance_km": round(dist_km, 2),
        "alternatives": [
            {"name": h["short"], "eta": max(3, int(haversine_distance(amb["lat"], amb["lng"], h["lat"], h["lng"]) * 3.8)), "beds": h["available_emergency"]}
            for h in ranked[1:3]
        ],
    }

# ---------------------------------------------------------
# EXTERNAL MOCK APIs (Week 1 Deliverable)
# ---------------------------------------------------------
@app.post("/mock/uidai/verify")
def mock_uidai_verify(aadhaar_number: str, otp: str):
    """Mocks Aadhaar OTP verification for NagrikID creation."""
    if otp == "123456": # Dummy OTP
        return {"status": "success", "aadhaar_hash": "hash_8f7d6c5b4a", "name": "Test Citizen"}
    return {"status": "failed", "message": "Invalid OTP"}

@app.get("/mock/parivahan/challans/{vehicle_number}")
def get_parivahan_details(vehicle_number: str):
    # In a real system, this would query the National Informatics Centre (NIC) database
    # For NagarIQ, we generate a realistic mock response for ANY scanned plate
    
    return {
        "status": "success",
        "vehicle_number": vehicle_number.upper(),
        "owner_name": "Rahul (NagarIQ Citizen)", # Mocking you as the owner!
        "vehicle_class": "Motor Car (LMV)",
        "registration_date": "12-Aug-2023",
        "pending_challans": 2,
        "fitness_valid_upto": "11-Aug-2038",
        "insurance_valid_upto": "11-Aug-2026"
    }

@app.get("/mock/cpcb/aqi")
def mock_cpcb_aqi(lat: float, lng: float):
    """Mocks real-time Air Quality Index."""
    return {"lat": lat, "lng": lng, "aqi": 145, "category": "Moderate"}


# ---------------------------------------------------------
# NAGRIK-ID AUTHENTICATION FLOW (Week 2 Deliverable)
# ---------------------------------------------------------
class OTPVerifyRequest(BaseModel):
    aadhaar_number: str
    phone: str
    otp: str

@app.post("/api/v1/auth/verify-otp")
def verify_otp_and_login(request: OTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Mocks Aadhaar OTP verification. If successful, creates a NagrikID user 
    (if they don't exist) and returns a JWT access token.
    """
    # 1. Mock the UIDAI OTP Check (Assume '123456' is always correct for dev)
    if request.otp != "123456":
        return {"status": "failed", "message": "Invalid Aadhaar OTP"}

    # 2. Hash the Aadhaar for DPDP Act Compliance (Data Minimization)
    hashed_aadhaar = auth.get_password_hash(request.aadhaar_number)
    
    # 3. Check if user already exists based on phone number
    user = db.query(models.User).filter(models.User.phone == request.phone).first()
    
    if not user:
        # Create new citizen profile
        user = models.User(
            aadhaar_hash=hashed_aadhaar, 
            phone=request.phone, 
            name=f"Nagrik_{request.phone[-4:]}", # Mock name generation
            role="citizen"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 4. Generate JWT Access Token
    access_token = auth.create_access_token(
        data={"sub": user.phone, "role": user.role, "user_id": user.id}
    )

    return {
        "status": "success", 
        "message": "Authentication successful",
        "access_token": access_token, 
        "token_type": "bearer",
        "user_details": {"id": user.id, "name": user.name, "role": user.role}
    }

@app.get("/api/v1/incidents")
def get_incidents(db: Session = Depends(get_db)):
    # Fetch all incidents, newest first
    incidents = db.query(models.Incident).order_by(models.Incident.timestamp.desc()).all()
    return {"status": "success", "data": incidents}

# --- NEW: STATUS TRACKING ENDPOINT ---
class StatusUpdateRequest(BaseModel):
    status: str
    assigned_unit: str = None

@app.patch("/api/v1/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, update: StatusUpdateRequest, db: Session = Depends(get_db)):
    incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    incident.status = update.status
    if update.assigned_unit:
        incident.assigned_unit = update.assigned_unit
    db.commit()
    return {"status": "success", "message": f"Incident {incident_id} updated to {update.status}"}

# --- NEW: NEXT-LEVEL TRAFFIC PREDICTION LSTM ---
class TrafficLSTM(nn.Module):
    def __init__(self, input_size=5, hidden_size=64, num_layers=2):
        super(TrafficLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])
        return out

# Initialize Traffic Model
TRAFFIC_MODEL = TrafficLSTM()
TRAFFIC_NODES = [
    {"id": "T-01", "name": "Rajwada Circle", "lat": 22.7180, "lng": 75.8540, "base_volume": 85},
    {"id": "T-02", "name": "Vijay Nagar Square", "lat": 22.7530, "lng": 75.8930, "base_volume": 92},
    {"id": "T-03", "name": "Bhawarkua Crossing", "lat": 22.6890, "lng": 75.8670, "base_volume": 78},
    {"id": "T-04", "name": "Palasia Square", "lat": 22.7225, "lng": 75.8850, "base_volume": 88},
    {"id": "T-05", "name": "Chhapani Chowk", "lat": 22.7126, "lng": 75.8777, "base_volume": 65},
]

@app.get("/api/v1/traffic/predict")
def predict_traffic_snapshot():
    """
    Multivariate LSTM Inference for city-wide traffic.
    Predicts volume (0-100) for the next 30 minutes.
    """
    predictions = []
    current_hour = datetime.datetime.now().hour
    is_weekend = 1 if datetime.datetime.now().weekday() >= 5 else 0
    
    for node in TRAFFIC_NODES:
        # Mock sequence data for LSTM (Last 24 steps)
        # Features: [historical_vol, hour_sin, hour_cos, is_weekend, weather_index]
        mock_sequence = torch.randn(1, 24, 5) 
        
        with torch.no_grad():
            pred_score = TRAFFIC_MODEL(mock_sequence).item()
            
        # Add actual city logic (Peak hours in Indore)
        peak_multi = 1.4 if (8 <= current_hour <= 11 or 17 <= current_hour <= 20) else 1.0
        adjusted_score = min(100, max(10, (node["base_volume"] * peak_multi) + (pred_score * 5)))
        
        predictions.append({
            "node_id": node["id"],
            "name": node["name"],
            "lat": node["lat"],
            "lng": node["lng"],
            "current_volume": round(adjusted_score - random.uniform(5, 15), 1),
            "predicted_volume": round(adjusted_score, 1),
            "trend": "increasing" if adjusted_score > node["base_volume"] else "stable",
            "congestion_level": "High" if adjusted_score > 80 else "Moderate" if adjusted_score > 50 else "Low"
        })
        
    return {"status": "success", "timestamp": datetime.datetime.now(), "forecast": predictions}

# --- NEW: AI SCHEME ELIGIBILITY ENGINE ---
GOVT_SCHEMES = [
    {
        "id": "SCH-001",
        "name": "PM Awas Yojana (Urban)",
        "benefit": "Home Loan Subsidy up to ₹2.67 Lakh",
        "category": "Housing",
        "criteria": {"max_income": 600000, "min_age": 18},
        "url": "https://pmay-urban.gov.in/"
    },
    {
        "id": "SCH-002",
        "name": "Ayushman Bharat",
        "benefit": "Free Health Cover up to ₹5 Lakh/year",
        "category": "Healthcare",
        "criteria": {"max_income": 250000, "priority": "BPL"},
        "url": "https://dashboard.pmjay.gov.in/"
    },
    {
        "id": "SCH-003",
        "name": "Pradhan Mantri Kaushal Vikas Yojana",
        "benefit": "Free Skills Training & Certification",
        "category": "Education",
        "criteria": {"min_age": 18, "max_age": 45},
        "url": "https://www.pmkvyofficial.org/"
    },
    {
        "id": "SCH-004",
        "name": "LADLI LAXMI 2.0 (Indore Special)",
        "benefit": "Higher Education Support for Female Students",
        "category": "Education",
        "criteria": {"gender": "Female", "state": "MP"},
        "url": "https://ladlilaxmi.mp.gov.in/"
    }
]

class SchemeEligibilityRequest(BaseModel):
    age: int
    income: float
    occupation: str
    gender: Optional[str] = "Any"
    state: Optional[str] = "MP"

@app.post("/api/v1/nagrik/schemes/eligible")
def get_eligible_schemes(profile: SchemeEligibilityRequest, current_user: dict = Depends(auth.get_current_user)):
    """AI logic to filter schemes based on citizen profile."""
    eligible = []
    for s in GOVT_SCHEMES:
        crit = s["criteria"]
        is_match = True
        
        if "max_income" in crit and profile.income > crit["max_income"]: is_match = False
        if "min_age" in crit and profile.age < crit["min_age"]: is_match = False
        if "max_age" in crit and profile.age > crit["max_age"]: is_match = False
        if "gender" in crit and profile.gender != crit["gender"] and crit["gender"] != "Any": is_match = False
        
        if is_match:
            eligible.append(s)
            
    return {"status": "success", "schemes": eligible}

# --- NEW: NAGRIK NOTIFICATION ENGINE ---
NOTIFICATIONS = []

@app.get("/api/v1/nagrik/notifications")
def get_notifications(current_user: dict = Depends(auth.get_current_user)):
    """Fetch unread AI-triggered notifications."""
    global NOTIFICATIONS
    return {"status": "success", "notifications": NOTIFICATIONS}

@app.post("/api/v1/nagrik/notifications/clear")
def clear_notifications(current_user: dict = Depends(auth.get_current_user)):
    global NOTIFICATIONS
    NOTIFICATIONS = []
    return {"status": "success"}

# --- 🚨 NAGARSANKAT: GEOFENCED BROADCAST ---
class GeofenceAlertRequest(BaseModel):
    message: str
    polygon: List[List[float]] # List of [lat, lng]
    
ACTIVE_GEOFENCE_ALERTS = []

@app.post("/api/v1/nagarsankat/broadcast")
def broadcast_geofence_alert(req: GeofenceAlertRequest):
    global NOTIFICATIONS
    alert_id = f"SANKAT-{uuid.uuid4().hex[:6].upper()}"
    alert = {
        "id": alert_id,
        "message": req.message,
        "polygon": req.polygon,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    ACTIVE_GEOFENCE_ALERTS.insert(0, alert)
    
    # Simulate citizen being inside the geofence
    new_notif = {
        "id": alert_id,
        "title": "🚨 NAGARSANKAT ALERT",
        "message": req.message,
        "timestamp": datetime.datetime.now().strftime("%I:%M %p"),
        "type": "emergency"
    }
    NOTIFICATIONS.append(new_notif)
    
    return {"status": "success", "alert_id": alert_id, "message": "Geofenced alert broadcasted successfully"}

@app.get("/api/v1/nagarsankat/alerts")
def get_geofence_alerts():
    return {"status": "success", "alerts": ACTIVE_GEOFENCE_ALERTS}

# --- NEW: DOCUMENT PARSING (Nagrik OCR) ---
@app.post("/api/v1/nagrik/vault/upload")
def upload_and_parse_document(image: dict, current_user: dict = Depends(auth.get_current_user)):
    """Simulates AI Parsing (EasyOCR/IndicBERT) and triggers notifications."""
    global NOTIFICATIONS
    
    # Simulate finding new eligibility after parsing
    new_notif = {
        "id": str(uuid.uuid4()),
        "title": "🎉 New Scheme Matched!",
        "message": "Based on your updated Income Certificate, you are now eligible for Ayushman Bharat (Free Health Cover).",
        "timestamp": datetime.datetime.now().strftime("%I:%M %p"),
        "type": "scheme_match"
    }
    NOTIFICATIONS.append(new_notif)

    return {
        "status": "success",
        "parsed_data": {
            "doc_type": "Income Certificate",
            "extracted_name": "RAHUL VYAS",
            "annual_income": "₹4,50,000",
            "valid_until": "2027-03-12",
            "confidence": 0.94
        },
        "message": "AI successfully parsed your document. Check your Yojana tab for new matches!"
    }

# --- NEW: UNIFIED PUBLIC DATA HUB (Challans, Bills, Health) ---
VEHICLES = [
    {"id": "V-01", "plate": "MP 09 AB 1234", "model": "Tata Nexon EV", "puc_valid_until": "2026-10-12"},
    {"id": "V-02", "plate": "MP 09 CZ 5678", "model": "Royal Enfield Himalayan", "puc_valid_until": "2025-12-01"}
]

CHALLANS = [
    {"id": "CH-9981", "vehicle": "MP 09 AB 1234", "reason": "No Helmet (CCTV)", "amount": 500.0, "status": "Pending", "date": "2026-03-10"},
    {"id": "CH-9942", "vehicle": "MP 09 CZ 5678", "reason": "Speeding at Vijay Nagar Square", "amount": 1000.0, "status": "Pending", "date": "2026-03-12"}
]

UTILITY_BILLS = [
    {"id": "BILL-001", "type": "Electricity", "provider": "MPPKVVCL", "amount": 1450.0, "due_date": "2026-03-25", "status": "Unpaid"},
    {"id": "BILL-002", "type": "Water", "provider": "IMC (Indore Municipal Corp)", "amount": 320.0, "due_date": "2026-04-01", "status": "Paid"},
    {"id": "BILL-003", "type": "Property Tax", "provider": "IMC Govt", "amount": 4500.0, "due_date": "2026-06-30", "status": "Partially Paid"}
]

HEALTH_DATA = {
    "blood_group": "B+ Positive",
    "allergies": ["Penicillin", "Dust"],
    "chronic_conditions": ["None"],
    "emergency_contact": "9876543210 (Mother)",
    "abua_id": "rahul.vyas@abdm"
}

@app.get("/api/v1/nagrik/profile/full")
def get_full_citizen_profile(current_user: dict = Depends(auth.get_current_user)):
    """The 'Single Source of Truth' for all Nagrik data."""
    return {
        "status": "success",
        "data": {
            "identity": {
                "name": "Rahul Vyas",
                "dob": "1999-05-15",
                "phone": "+91 9988776655",
                "address": "74, Scheme No. 54, Vijay Nagar, Indore, MP"
            },
            "vehicles": VEHICLES,
            "challans": CHALLANS,
            "bills": UTILITY_BILLS,
            "health": HEALTH_DATA
        }
    }

@app.post("/api/v1/nagrik/wallet/pay/{item_id}")
def pay_nagrik_due(item_id: str, db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    """Simulates payment of a bill or challan."""
    global CHALLANS
    for ch in CHALLANS:
        if ch["id"] == item_id:
            if ch["status"] == "Paid":
                return {"status": "error", "message": "Challan already paid"}
            ch["status"] = "Paid"
            
            # Award points for paying challan
            nagar_score.add_points(db, "CIT-007", "VERIFIED_CHALLAN")
            
            return {
                "status": "success", 
                "message": f"Payment of ₹{ch['amount']} for {item_id} successfully processed.",
                "receipt": {"payment_id": f"RCT-{item_id}", "amount": ch["amount"]}
            }
    
    return {"status": "error", "message": "Item not found"}

# --- NEW: DIGITAL DOCUMENT VAULT (Nagrik360) ---
@app.get("/api/v1/nagrik/documents")
def get_nagrik_documents(current_user: dict = Depends(auth.get_current_user)):
    """Mocks DigiLocker sync for the citizen's government documents."""
    return {
        "status": "success",
        "timestamp": datetime.datetime.utcnow(),
        "documents": [
            {
                "id": "DOC-ADR",
                "name": "Aadhaar Card",
                "issuer": "UIDAI",
                "number": "XXXX-XXXX-8892",
                "type": "Identity",
                "last_synced": "2 Hours ago",
                "status": "Verified",
                "verify_token": "V-ADR-9021-3"
            },
            {
                "id": "DOC-PAN",
                "name": "PAN Card",
                "issuer": "Income Tax Department",
                "number": "ABCDE1234F",
                "type": "Taxation",
                "last_synced": "1 Day ago",
                "status": "Verified",
                "verify_token": "V-PAN-4432-8"
            },
            {
                "id": "DOC-DL",
                "name": "Driving License",
                "issuer": "Ministry of Road Transport",
                "number": "MP09 2023 008821",
                "type": "Permit",
                "last_synced": "Just now",
                "status": "Verified",
                "verify_token": "V-DL-1102-5"
            },
            {
                "id": "DOC-PTX",
                "name": "Property Tax Receipt",
                "issuer": "Indore Municipal Corp.",
                "number": "IMC-2024-PT-901",
                "type": "Civic",
                "last_synced": "3 Days ago",
                "status": "Verified",
                "verify_token": "V-PTX-8271-0"
            }
        ]
    }

from app import aria # <-- ARIA Intelligence Engine

# --- NEW: INDORE-311 GRIEVANCE MODULE ---
class GrievanceReport(BaseModel):
    category: str
    description: str
    lat: float
    lng: float

@app.post("/api/v1/grievances")
def report_grievance(report: GrievanceReport, current_user: dict = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """AI-powered grievance reporting."""
    g_id = f"GRI-{uuid.uuid4().hex[:8].upper()}"
    
    # Priority logic (ARIA Semantic AI Simulation)
    priority = aria.aria_analyze_grievance_severity(report.description)
    
    # Base category boosts (e.g. Water/Sewerage inherently more urgent than generic complaints)
    if report.category in ["Sewerage", "Water Leak", "Electricity"]:
        priority = min(5, priority + 1)
    
    # Apply a tiny random jitter so multiple complaints at the exact same location don't overlap visually
    jitter_lat = random.uniform(-0.0003, 0.0003)
    jitter_lng = random.uniform(-0.0003, 0.0003)
    
    new_g = models.Grievance(
        id=g_id,
        citizen_id=current_user["user_id"],
        category=report.category,
        description=report.description,
        lat=report.lat + jitter_lat,
        lng=report.lng + jitter_lng,
        priority=priority,
        address="Automatic GPS Location, Indore"
    )
    db.add(new_g)
    db.commit()
    
    # Gamification: Award points to the user for reporting a civic issue!
    nagar_score.add_points(db, "CIT-007", "REPORT_POTHOLE")
    
    return {"status": "success", "id": g_id, "priority": priority}

@app.get("/api/v1/grievances")
def get_all_grievances(db: Session = Depends(get_db)):
    """Fetch all reported grievances for the 'City Health' Dashboard."""
    return {"status": "success", "grievances": db.query(models.Grievance).all()}

# ==========================================
# PARIVAHAN: ANPR & TRAFFIC VIOLATION ENGINE
# ==========================================

@app.get("/api/v1/anpr/cameras")
def get_cctv_cameras():
    """Returns all CCTV camera locations for the Parivahan map layer."""
    return {"status": "success", "cameras": anpr.CCTV_CAMERAS}


@app.post("/api/v1/anpr/scan/{camera_id}")
def trigger_anpr_scan(camera_id: str, db: Session = Depends(get_db)):
    """
    Simulates one ANPR scan on the given camera.
    Runs EasyOCR on a generated plate image, checks stolen-vehicle DB,
    stores and returns the violation record.
    """
    result = anpr.simulate_anpr_scan(camera_id)
    if result is None:
        return {"status": "clean", "message": "No violation detected - clean pass."}

    v_id = f"VIO-{uuid.uuid4().hex[:6].upper()}"
    record = models.ViolationRecord(
        id=v_id,
        camera_id=result["camera_id"],
        camera_name=result["camera_name"],
        lat=result["lat"],
        lng=result["lng"],
        zone=result["zone"],
        plate_detected=result["plate_detected"],
        violation_type=result["violation_type"],
        is_stolen=1 if result["is_stolen"] else 0,
        confidence=result["confidence"],
        plate_image=result["plate_image"],
    )
    db.add(record)
    db.commit()
    result["id"] = v_id
    return {"status": "violation", "data": result}


@app.get("/api/v1/anpr/violations")
def get_recent_violations(limit: int = 30, db: Session = Depends(get_db)):
    """Returns the most recent ANPR violation records for the dashboard feed."""
    rows = (
        db.query(models.ViolationRecord)
        .order_by(models.ViolationRecord.timestamp.desc())
        .limit(limit)
        .all()
    )
    data = [
        {
            "id": r.id,
            "camera_id": r.camera_id,
            "camera_name": r.camera_name,
            "lat": r.lat,
            "lng": r.lng,
            "zone": r.zone,
            "plate_detected": r.plate_detected,
            "violation_type": r.violation_type,
            "is_stolen": bool(r.is_stolen),
            "confidence": r.confidence,
            "plate_image": r.plate_image,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]
    return {"status": "success", "violations": data}


@app.get("/api/v1/anpr/stolen")
def get_stolen_database():
    """Returns the mock stolen-vehicle watchlist."""
    return {"status": "success", "plates": list(anpr.STOLEN_VEHICLE_DB)}


# ────────────────────────────────────────────────────────────
# 📷 FACETRACE — MISSING PERSON SEARCH
# ────────────────────────────────────────────────────────────
from fastapi import UploadFile, File, Form

@app.get("/api/v1/facetrace/cameras")
def get_facetrace_cameras():
    """Returns all CCTV cameras in the FaceTrace grid."""
    return {"status": "success", "cameras": face_trace.CCTV_CAMERAS}

@app.post("/api/v1/facetrace/search")
async def facetrace_search(
    photo: UploadFile = File(...),
    subject_name: str = Form(default="Unknown"),
):
    """
    📷 FaceTrace: Upload a missing person photo.
    DeepFace analyzes the face and searches across the CCTV camera grid.
    """
    # Read uploaded photo bytes
    image_bytes = await photo.read()
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Step 1: DeepFace analysis (real AI)
    print(f"[FaceTrace] 📷 Analyzing face for '{subject_name}'...")
    face_data = face_trace.analyze_face_with_deepface(image_bytes)

    if not face_data["success"]:
        raise HTTPException(status_code=422, detail="No face detected in the uploaded photo. Please use a clear, front-facing photo.")

    # Step 2: Search the CCTV grid
    print(f"[FaceTrace] 🔍 Scanning {len(face_trace.CCTV_CAMERAS)} cameras...")
    result = face_trace.search_cctv_grid(face_data, subject_name)

    print(f"[FaceTrace] ✅ Found {result['matches_found']} match(es) for '{subject_name}' — Status: {result['status']}")
    return {"status": "success", **result}


# ═══════════════════════════════════════════════════════════
# 💧 JAL SHAKTI: WATER MONITORING & LSTM PREDICTION
# ═══════════════════════════════════════════════════════════

@app.get("/api/v1/water/zones")
def water_zones():
    """Get live IoT sensor readings for all 8 Indore water zones."""
    zones = jal_shakti.get_all_zone_states()
    if not zones:
        # Return static zone data if monitoring loop hasn't run yet
        zones = [jal_shakti._generate_sensor_readings(z) for z in jal_shakti.WATER_ZONES]
    summary = {
        "total_zones": len(zones),
        "critical_zones": sum(1 for z in zones if z["status"] == "CRITICAL"),
        "low_zones": sum(1 for z in zones if z["status"] == "LOW"),
        "avg_tank_level_pct": round(sum(z["tank_level_pct"] for z in zones) / len(zones), 1) if zones else 0,
    }
    return {"status": "ok", "zones": zones, "summary": summary}


@app.get("/api/v1/water/alerts")
def water_alerts():
    """Get all active water supply alerts and LSTM-predicted disruptions."""
    alerts = jal_shakti.get_active_alerts()
    return {"status": "ok", "alerts": alerts, "total": len(alerts)}


@app.get("/api/v1/water/predict/{zone_id}")
def water_predict(zone_id: str):
    """Get 24-hour LSTM supply prediction for a specific zone."""
    prediction = jal_shakti.get_zone_prediction(zone_id)
    if not prediction:
        # Generate on-demand if cache miss
        zone = next((z for z in jal_shakti.WATER_ZONES if z["id"] == zone_id), None)
        if not zone:
            raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")
        reading = jal_shakti._generate_sensor_readings(zone)
        prediction = jal_shakti._lstm_predict_supply(zone, reading["tank_level_pct"])
    return {"status": "ok", "prediction": prediction}


# ═══════════════════════════════════════════════════════════
# 🧾 AI CHALLAN DISPUTE (OCR + NLP + PDF)
# ═══════════════════════════════════════════════════════════

@app.post("/api/v1/challan/dispute")
async def analyze_challan(
    photo: UploadFile = File(...),
    citizen_name: str = Form(default="Citizen"),
    citizen_address: str = Form(default=""),
    citizen_contact: str = Form(default=""),
):
    """
    Scan challan photo, run OCR, validate with MV Act, and generate dispute PDF.
    """
    image_bytes = await photo.read()
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Invalid or empty image file")

    try:
        result = challan_dispute.process_challan(
            image_bytes=image_bytes,
            citizen_name=citizen_name,
            citizen_address=citizen_address,
            citizen_contact=citizen_contact,
        )
        return {"status": "success", **result}
    except Exception as e:
        print(f"[ChallanAI] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════
# 🌍 NAGARSEVA VOLUNTEERS (Civilians as First Responders)
# ═══════════════════════════════════════════════════════════

@app.get("/api/v1/volunteers")
def get_nagarseva_volunteers():
    """Returns active NagarSeva volunteers on duty."""
    volunteers = nagar_seva.get_active_volunteers()
    return {"status": "success", "volunteers": volunteers, "count": len(volunteers)}

# ═══════════════════════════════════════════════════════════
# 🌡️ HEAT ISLAND RISK ENGINE (Urban Mortality Alerts)
# ═══════════════════════════════════════════════════════════

@app.get("/api/v1/heat/zones")
def get_heat_zones():
    """Get all heat island sensor readings and current active heat stroke alerts."""
    return {
        "status": "success", 
        "zones": heat_island.get_all_zones(), 
        "alerts": heat_island.get_active_alerts()
    }

# ═══════════════════════════════════════════════════════════
# 🎯 NAGARSCORE GAMIFICATION
# ═══════════════════════════════════════════════════════════

@app.get("/api/v1/nagarscore/leaderboard")
def get_nagarscore_leaderboard(db: Session = Depends(get_db)):
    """Returns the top citizens of the city based on NagarScore."""
    return {"status": "success", "leaderboard": nagar_score.get_leaderboard(db)}

@app.get("/api/v1/nagarscore/profile/{citizen_id}")
def get_citizen_nagarscore(citizen_id: str, db: Session = Depends(get_db)):
    """Returns the gamification profile for a specific citizen."""
    profile = nagar_score.get_citizen_profile(db, citizen_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Citizen not found")
    return {"status": "success", "profile": profile}

class ScoreActionRequest(BaseModel):
    action: str

@app.post("/api/v1/nagarscore/award/{citizen_id}")
def award_nagarscore_points(citizen_id: str, req: ScoreActionRequest, db: Session = Depends(get_db)):
    """Awards XP to a citizen for performing a civic action."""
    result = nagar_score.add_points(db, citizen_id, req.action)
    if result.get("status") == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    return result

# ═══════════════════════════════════════════════════════════
# 🚌 NAGARYATRA — SMART TRANSIT ENGINE
# ═══════════════════════════════════════════════════════════

@app.get("/api/v1/transit/buses")
def get_live_buses():
    """Returns live GPS positions of all iBus city buses."""
    return {"status": "success", "buses": nagar_yatra.get_all_buses()}

@app.get("/api/v1/transit/stops")
def get_bus_stops():
    """Returns all bus stops across all city routes."""
    return {"status": "success", "stops": nagar_yatra.get_all_stops()}

class TicketRequest(BaseModel):
    citizen_id: str
    route_id: str
    from_stop: str
    to_stop: str

@app.post("/api/v1/transit/ticket/issue")
def issue_nagarpass_ticket(req: TicketRequest, current_user: dict = Depends(auth.get_current_user)):
    """Issues a NagarPass QR digital bus ticket for the citizen."""
    result = nagar_yatra.issue_ticket(req.citizen_id, req.route_id, req.from_stop, req.to_stop)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.get("/api/v1/transit/ticket/validate/{ticket_id}")
def validate_nagarpass_ticket(ticket_id: str):
    """Validates a NagarPass QR ticket at the bus gate."""
    return nagar_yatra.validate_ticket(ticket_id)

# ═══════════════════════════════════════════════════════
# 💰 NAGARKHATA — UNIFIED MUNICIPAL BILLING & TAX PORTAL
# ═══════════════════════════════════════════════════════

@app.get("/api/v1/khata/summary/{citizen_id}")
def get_khata_summary(citizen_id: str, db: Session = Depends(get_db)):
    """Returns the full billing summary + NagarScore tier discount for a citizen."""
    # Fetch the citizen's current NagarScore tier for discount calculation
    profile = nagar_score.get_citizen_profile(db, citizen_id)
    tier = profile["tier"] if profile else "Bronze"
    return {"status": "success", "summary": nagar_khata.get_bill_summary(citizen_id, tier)}

@app.get("/api/v1/khata/bills/{citizen_id}")
def get_citizen_bills(citizen_id: str, db: Session = Depends(get_db)):
    """Returns itemised list of all pending & paid municipal bills."""
    profile = nagar_score.get_citizen_profile(db, citizen_id)
    tier = profile["tier"] if profile else "Bronze"
    bills = nagar_khata.get_citizen_bills(citizen_id, tier)
    return {"status": "success", "bills": bills}

class PaymentRequest(BaseModel):
    payment_method: str = "UPI"

@app.post("/api/v1/khata/pay/{citizen_id}/{bill_id}")
def pay_municipal_bill(
    citizen_id: str,
    bill_id: str,
    req: PaymentRequest,
    current_user: dict = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Processes payment for a specific municipal bill and generates a digital receipt."""
    result = nagar_khata.process_payment(citizen_id, bill_id, req.payment_method)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    # Award NagarScore XP for paying on time
    nagar_score.add_points(db, citizen_id, "PAY_TAX_ON_TIME")
    return result

@app.get("/api/v1/khata/history/{citizen_id}")
def get_payment_history(citizen_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Returns the complete payment receipt history for a citizen."""
    history = nagar_khata.get_payment_history(citizen_id)
    return {"status": "success", "history": history}
