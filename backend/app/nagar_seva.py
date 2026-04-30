"""
🌍 NagarSeva Volunteers — NagarIQ Smart City OS
=================================================
Manages civilian "blue-dot" first responders who have opted in
to receive emergency alerts and assist authorities.
"""

import random
import datetime
import uuid

# Base coordinates for Indore
INDORE_LAT = 22.7196
INDORE_LNG = 75.8577

# Generate some simulated active volunteers
_volunteers = []

def _generate_mock_volunteers(count=15):
    first_names = ["Rahul", "Amit", "Priya", "Neha", "Vikram", "Suresh", "Anjali", "Rohan", "Pooja", "Deepak"]
    last_names = ["Sharma", "Verma", "Patil", "Singh", "Jain", "Gupta", "Mishra", "Chouhan"]
    skills = ["CPR Certified", "First Aid", "Fire Safety", "Traffic Management", "General Volunteer"]
    
    volunteers = []
    for _ in range(count):
        lat = INDORE_LAT + random.uniform(-0.04, 0.04)
        lng = INDORE_LNG + random.uniform(-0.04, 0.04)
        
        # Simulate movement
        velocity_lat = random.uniform(-0.0001, 0.0001)
        velocity_lng = random.uniform(-0.0001, 0.0001)
        
        volunteers.append({
            "id": f"VOL-{uuid.uuid4().hex[:6].upper()}",
            "name": f"{random.choice(first_names)} {random.choice(last_names)}",
            "lat": lat,
            "lng": lng,
            "velocity_lat": velocity_lat,
            "velocity_lng": velocity_lng,
            "skills": random.sample(skills, k=random.randint(1, 2)),
            "status": random.choice(["ON_DUTY", "ON_DUTY", "ON_DUTY", "RESPONDING"]),
            "last_active": datetime.datetime.now().isoformat()
        })
    return volunteers

# Initialize mock data
_volunteers = _generate_mock_volunteers(15)

def get_active_volunteers():
    """Returns the list of active volunteers, simulating their movement."""
    for v in _volunteers:
        # Move them slightly
        v["lat"] += v["velocity_lat"]
        v["lng"] += v["velocity_lng"]
        
        # Bounce off boundaries to keep them near Indore
        if abs(v["lat"] - INDORE_LAT) > 0.05:
            v["velocity_lat"] *= -1
        if abs(v["lng"] - INDORE_LNG) > 0.05:
            v["velocity_lng"] *= -1
            
        v["last_active"] = datetime.datetime.now().isoformat()
        
    return _volunteers
