"""
🎓 VidyaTrack: Government Schools & Student Attendance Monitoring System
NagarIQ Smart City OS
========================================================================
Tracks real-time student check-ins, attendance rates, mid-day meal status,
and infrastructure health for government schools across Indore.
"""

import asyncio
import random
import datetime
import uuid
from typing import Dict, List

# Indore base coordinates
INDORE_LAT = 22.7196
INDORE_LNG = 75.8577

# Government Schools Definition
GOVT_SCHOOLS = [
    {
        "id": "SCH-IND-01",
        "name": "Govt. Bal Vinay Mandir School",
        "type": "Higher Secondary (1-12)",
        "address": "Mahatma Gandhi Road, Indore",
        "lat": 22.7208,
        "lng": 75.8690,
        "total_enrolled": 850,
        "principal": "Dr. Ramesh Chandra Joshi",
        "smart_classrooms": 8,
        "contact": "0731-2549210",
        "meal_menu": "Dal Bafla & Laddu (Indore Special)"
    },
    {
        "id": "SCH-IND-02",
        "name": "Govt. High School, Rajwada Circle",
        "type": "High School (6-10)",
        "address": "Near Rajwada Palace, Indore",
        "lat": 22.7175,
        "lng": 75.8535,
        "total_enrolled": 520,
        "principal": "Mrs. Savita Vyas",
        "smart_classrooms": 4,
        "contact": "0731-2431055",
        "meal_menu": "Kadhi Chawal & Aloo Sabji"
    },
    {
        "id": "SCH-IND-03",
        "name": "Govt. Girls Higher Sec. School, Palasia",
        "type": "Girls Higher Secondary (6-12)",
        "address": "Old Palasia Road, Indore",
        "lat": 22.7235,
        "lng": 75.8860,
        "total_enrolled": 980,
        "principal": "Dr. Meera Deshmukh",
        "smart_classrooms": 12,
        "contact": "0731-2567812",
        "meal_menu": "Poori Sabji & Kheer"
    },
    {
        "id": "SCH-IND-04",
        "name": "Govt. Primary School, Bhawarkuan Crossing",
        "type": "Primary School (1-5)",
        "address": "Near Bhawarkua Square, Indore",
        "lat": 22.6942,
        "lng": 75.8675,
        "total_enrolled": 310,
        "principal": "Mr. Vinod Kumar Sharma",
        "smart_classrooms": 2,
        "contact": "0731-2490124",
        "meal_menu": "Pulao, Dal & Banana"
    },
    {
        "id": "SCH-IND-05",
        "name": "Govt. Model School, Vijay Nagar",
        "type": "Higher Secondary (1-12)",
        "address": "Scheme 54, Vijay Nagar, Indore",
        "lat": 22.7540,
        "lng": 75.8942,
        "total_enrolled": 1150,
        "principal": "Mr. Anand Vardhan",
        "smart_classrooms": 15,
        "contact": "0731-2854932",
        "meal_menu": "Roti, Dal Fry & Mix Veg"
    },
    {
        "id": "SCH-IND-06",
        "name": "Govt. Harijan Higher Secondary School",
        "type": "Higher Secondary (1-12)",
        "address": "Nanda Nagar, Indore",
        "lat": 22.7395,
        "lng": 75.8752,
        "total_enrolled": 640,
        "principal": "Mrs. Anita Raghuvanshi",
        "smart_classrooms": 6,
        "contact": "0731-2321456",
        "meal_menu": "Khichdi & Roasted Papad"
    }
]

# Real-time state store
school_states: Dict[str, dict] = {}
recent_events: List[dict] = []

# Mock student names for live feed
STUDENT_NAMES = [
    "Aarav", "Vihaan", "Vivaan", "Ananya", "Diya", "Aditya", "Sai", "Ishaan", 
    "Shaurya", "Krishna", "Arjun", "Kabir", "Aryan", "Aaditya", "Aarush", 
    "Pranav", "Saanvi", "Aanya", "Pari", "Aadhya", "Pihu", "Kavya", "Arika",
    "Rahul", "Amit", "Priya", "Neha", "Vikram", "Suresh", "Anjali", "Rohan"
]
STUDENT_SURNAMES = [
    "Sharma", "Verma", "Patil", "Singh", "Jain", "Gupta", "Mishra", "Chouhan",
    "Yadav", "Joshi", "Patel", "Shrivastava", "Tiwari", "Pandey", "Rao"
]

def init_school_states():
    global school_states
    for s in GOVT_SCHOOLS:
        # Base attendance between 75% and 90%
        base_rate = random.uniform(0.75, 0.92)
        active_count = int(s["total_enrolled"] * base_rate)
        
        school_states[s["id"]] = {
            **s,
            "active_students": active_count,
            "attendance_rate": round(base_rate * 100, 1),
            "meal_status": "PREPARING" if random.random() < 0.3 else "SERVED",
            "meals_served": int(active_count * random.uniform(0.85, 0.95)) if random.random() >= 0.3 else 0,
            "cctv_status": "ONLINE" if random.random() < 0.9 else "OFFLINE",
            "water_purifier_status": "FUNCTIONAL" if random.random() < 0.95 else "MAINTENANCE_REQUIRED",
            "last_sync": datetime.datetime.now().isoformat()
        }

init_school_states()

def simulate_school_tick():
    """Simulates real-time fluctuations and RFID check-in events."""
    global school_states, recent_events
    
    # Pick a random school to trigger a check-in/check-out event
    school_id = random.choice(list(school_states.keys()))
    state = school_states[school_id]
    
    # Decide if someone is entering, exiting, or meal progress
    action = random.choice(["CHECK_IN", "CHECK_IN", "CHECK_OUT", "MEAL_SERVE"])
    
    if action == "CHECK_IN" and state["active_students"] < state["total_enrolled"]:
        state["active_students"] += 1
        name = f"{random.choice(STUDENT_NAMES)} {random.choice(STUDENT_SURNAMES)}"
        event = {
            "id": str(uuid.uuid4())[:8],
            "school_id": school_id,
            "school_name": state["name"],
            "student_name": name,
            "type": "CHECK_IN",
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "message": f"RFID: {name} checked into {state['name']}."
        }
        recent_events.insert(0, event)
    
    elif action == "CHECK_OUT" and state["active_students"] > int(state["total_enrolled"] * 0.5):
        state["active_students"] -= 1
        name = f"{random.choice(STUDENT_NAMES)} {random.choice(STUDENT_SURNAMES)}"
        event = {
            "id": str(uuid.uuid4())[:8],
            "school_id": school_id,
            "school_name": state["name"],
            "student_name": name,
            "type": "CHECK_OUT",
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "message": f"RFID: {name} checked out of {state['name']}."
        }
        recent_events.insert(0, event)
        
    elif action == "MEAL_SERVE" and state["meal_status"] == "PREPARING":
        state["meals_served"] += random.randint(10, 30)
        if state["meals_served"] >= int(state["active_students"] * 0.9):
            state["meal_status"] = "SERVED"
            state["meals_served"] = state["active_students"]
            event = {
                "id": str(uuid.uuid4())[:8],
                "school_id": school_id,
                "school_name": state["name"],
                "student_name": "Mid-day Meal Staff",
                "type": "MEAL_COMPLETED",
                "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
                "message": f"Mid-day meal distribution complete at {state['name']} ({state['meals_served']} served)."
            }
            recent_events.insert(0, event)

    # Recalculate attendance rates
    state["attendance_rate"] = round((state["active_students"] / state["total_enrolled"]) * 100, 1)
    state["last_sync"] = datetime.datetime.now().isoformat()
    
    # Cap recent events at 30
    recent_events = recent_events[:30]

async def attendance_monitoring_loop():
    """Runs in the background every 5-10 seconds to update school stats."""
    print("🎓 [VidyaTrack] School Attendance IoT Sim online — monitoring 6 Indore government schools...")
    while True:
        try:
            simulate_school_tick()
        except Exception as e:
            print(f"[VidyaTrack] Simulation error: {e}")
        await asyncio.sleep(random.uniform(4, 8))

def get_all_schools():
    return list(school_states.values())

def get_recent_events():
    return recent_events
