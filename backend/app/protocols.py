# E:\NagarIQ\backend\app\protocols.py

EMERGENCY_PROTOCOLS = {
    "Medical": {
        "title": "Medical Emergency Guide",
        "severity": "P1",
        "steps": [
            "Check for responsiveness: Tap and shout.",
            "If not breathing, start CPR: Push hard and fast in the center of the chest.",
            "Keep the patient warm and do not give anything by mouth.",
            "Clear a path for the paramedics."
        ],
        "icon": "heart-pulse"
    },
    "Road Accident": {
        "title": "Accident Response Protocol",
        "severity": "P1",
        "steps": [
            "Ensure your own safety first: Park away from the crash site.",
            "Assess the victims: Do NOT move them unless there is an immediate fire risk (spinal injury danger).",
            "Apply pressure to any bleeding wounds with a clean cloth.",
            "Switch on hazard lights to alert other drivers."
        ],
        "icon": "truck"
    },
    "Fire": {
        "title": "Fire Survival Tactics",
        "severity": "P1",
        "steps": [
            "Crawl low under smoke: The air is cleaner near the floor.",
            "Before opening doors, check the handle for heat.",
            "If clothes catch fire: Stop, Drop, and Roll.",
            "Evacuate immediately; do not return for belongings."
        ],
        "icon": "flame"
    },
    "Crime/Assault": {
        "title": "Personal Safety Protocol",
        "severity": "P2",
        "steps": [
            "Stay in a well-lit/populated area if possible.",
            "Keep the phone line open or stay on the app for silent recording.",
            "Try to note physical descriptions or vehicle numbers without escalating.",
            "Avoid direct confrontation; prioritize your escape."
        ],
        "icon": "shield-off"
    },
    "Natural Disaster": {
        "title": "Disaster Safety Guide",
        "severity": "P1",
        "steps": [
            "Find high ground if flooding is imminent.",
            "Stay away from glass windows and power lines.",
            "Follow official evacuation orders immediately.",
            "Keep an emergency kit (water, torch, first-aid) ready."
        ],
        "icon": "wind"
    },
    "Domestic Violence": {
        "title": "Safe Space Protocol",
        "severity": "P2",
        "steps": [
            "Move to a room with an exit; avoid kitchens or bathrooms.",
            "Identify safe neighbors or friends you can reach out to.",
            "The app is recording audio in the background (if silent SOS chosen).",
            "Police have been alerted to your registered home location."
        ],
        "icon": "home"
    },
    "Missing Person": {
        "title": "Reporting Protocol",
        "severity": "P3",
        "steps": [
            "Gather recent photographs and description of clothing.",
            "Note the exact time and location the person was last seen.",
            "Check with immediate friends and family members.",
            "A digital alert has been broadcast to nearby patrol units."
        ],
        "icon": "user-minus"
    },
    "Infrastructure Failure": {
        "title": "Civil Hazard Protocol",
        "severity": "P3",
        "steps": [
            "Keep a safe distance from wire leaks or structural damage.",
            "Take a photo of the hazard for the municipal team.",
            "Warn other commuters/citizens in the vicinity.",
            "Identify nearest landmarks for maintenance crew arrival."
        ],
        "icon": "alert-circle"
    }
}

DEFAULT_PROTOCOL = {
    "title": "Emergency Situation",
    "severity": "P2",
    "steps": [
        "Stay calm and remain on the line.",
        "Ensure your surroundings are safe.",
        "Follow dispatcher instructions upon arrival.",
        "Keep your phone accessible."
    ],
    "icon": "alert-triangle"
}

def get_protocol(category: str):
    return EMERGENCY_PROTOCOLS.get(category, DEFAULT_PROTOCOL)
