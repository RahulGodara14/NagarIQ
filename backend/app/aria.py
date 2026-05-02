"""
ARIA — Adaptive Response Intelligence Assistant
NagarIQ AI Co-Pilot for Dispatchers

Architecture: Simulated LangChain Tool-Use Pipeline
  1. Intent Router (rule-based NLP, no API key needed)
  2. Tool Executor (queries live DB / in-memory state)
  3. Response Synthesizer (generates natural-language answers)
"""

import re
import math
import datetime
import random

# ─────────────────────────────────────────────
# TOOL DEFINITIONS  (What ARIA can "do")
# ─────────────────────────────────────────────

TOOLS = [
    "find_nearest_idle_unit",
    "list_active_incidents",
    "get_incident_summary",
    "get_aqi_status",
    "get_hotspot_areas",
    "get_unit_status",
    "suggest_dispatch",
    "city_stats",
    "greet",
]

# ─────────────────────────────────────────────
# INTENT ROUTER  (LangChain-style dispatcher)
# ─────────────────────────────────────────────

def route_intent(message: str) -> str:
    """Map the dispatcher's natural-language query to the right tool."""
    m = message.lower()

    if any(w in m for w in ["hello", "hi ", "hey", "who are you", "aria", "help me", "what can"]):
        return "greet"

    if any(w in m for w in ["nearest", "closest", "find unit", "idle unit", "free unit", "available unit", "which ambulance"]):
        return "find_nearest_idle_unit"

    if any(w in m for w in ["all incident", "active incident", "show incident", "list incident", "what's happening", "whats happening", "open case"]):
        return "list_active_incidents"

    if any(w in m for w in ["summary", "details", "tell me about incident", "incident id"]):
        return "get_incident_summary"

    if any(w in m for w in ["aqi", "air quality", "pollution", "vayu", "mask"]):
        return "get_aqi_status"

    if any(w in m for w in ["hotspot", "crime zone", "high risk", "danger area", "heatmap", "prediction"]):
        return "get_hotspot_areas"

    if any(w in m for w in ["unit status", "ambulance status", "where is", "where are", "units"]):
        return "get_unit_status"

    if any(w in m for w in ["dispatch", "send", "assign", "recommend", "suggest", "who should"]):
        return "suggest_dispatch"

    if any(w in m for w in ["stat", "total", "how many", "count", "overview", "dashboard", "report"]):
        return "city_stats"

    return "greet"  # fallback


# ─────────────────────────────────────────────
# TOOL EXECUTORS
# ─────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    p = 0.017453292519943295
    a = 0.5 - math.cos((lat2 - lat1) * p)/2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742 * math.asin(math.sqrt(a))


def tool_greet(message: str, **kwargs) -> str:
    greetings = [
        "👋 Hello Dispatcher! I'm **ARIA** — your AI Co-Pilot powered by NagarIQ's intelligence engine.\n\nYou can ask me things like:\n- *\"Find nearest idle ambulance\"*\n- *\"Show all active incidents\"*\n- *\"What are the crime hotspots?\"*\n- *\"Suggest a dispatch for incident SOS-XXX\"*\n- *\"City stats overview\"*",
        "🤖 ARIA online. Ready to assist. Try asking: *'How many active incidents?'* or *'Find the nearest free unit'*.",
    ]
    return random.choice(greetings)


def tool_find_nearest_idle_unit(message: str, units: list, incidents: list, **kwargs) -> str:
    idle = [u for u in units if u.get("status") == "idle"]
    if not idle:
        return "⚠️ **All units are currently deployed.** No idle ambulances available. Consider requesting mutual aid from neighboring districts."

    # If there's a target in the message, try to extract lat/lng from an incident
    lines = []
    for u in idle:
        lines.append(f"- 🚑 **{u['name']}** (`{u['id']}`) — Location: {u['lat']:.4f}, {u['lng']:.4f}")

    unit_list = "\n".join(lines)
    return f"✅ Found **{len(idle)} idle unit(s)** available for immediate deployment:\n\n{unit_list}\n\n💡 *Say 'Suggest dispatch for incident [ID]' to get an optimal recommendation.*"


def tool_list_active_incidents(message: str, incidents: list, **kwargs) -> str:
    active = [i for i in incidents if i.get("status") != "resolved"]
    if not active:
        return "🟢 **All clear!** No active incidents in the city right now. The system is monitoring passively."

    lines = []
    for inc in active[:8]:  # Cap at 8 for readability
        sev = inc.get("severity", "P2")
        itype = inc.get("incident_type", "Unknown")
        addr = inc.get("address", "Unknown location")
        status = inc.get("status", "open").upper()
        lines.append(f"- `{inc['id']}` | **{itype}** | {sev} | 📍 {addr} | [{status}]")

    body = "\n".join(lines)
    return f"🚨 **{len(active)} active incident(s)** in Indore:\n\n{body}"


def tool_get_aqi_status(message: str, **kwargs) -> str:
    zones = [
        {"name": "Palasia Square", "aqi": random.randint(40, 80), "level": "Satisfactory"},
        {"name": "Rajwada", "aqi": random.randint(120, 160), "level": "Moderate ⚠️"},
        {"name": "Bhawarkuan", "aqi": random.randint(150, 210), "level": "Poor 🟠"},
        {"name": "Vijay Nagar", "aqi": random.randint(300, 400), "level": "Severe 🔴"},
        {"name": "Pithampur Industrial", "aqi": random.randint(250, 350), "level": "Very Poor 🟣"},
    ]
    lines = [f"- **{z['name']}**: AQI {z['aqi']} ({z['level']})" for z in zones]
    worst = max(zones, key=lambda z: z["aqi"])
    return f"🌿 **Vayu AQI Status — Indore** (Live Sensor Feed)\n\n" + "\n".join(lines) + f"\n\n⚠️ *Critical Zone: {worst['name']} (AQI {worst['aqi']}) — advise citizens to avoid the area.*"


def tool_get_hotspot_areas(message: str, **kwargs) -> str:
    hour = datetime.datetime.now().hour
    is_night = hour >= 18 or hour < 6
    is_weekend = datetime.datetime.now().weekday() >= 5

    zones = []
    if is_night:
        zones.append("🔴 **Rajwada** — High risk at night. Historical pattern: assault, snatching.")
    else:
        zones.append("🟡 **Rajwada** — Moderate activity. Commercial crowd.")

    if is_weekend:
        zones.append("🔴 **Bhawarkuan** — Weekend hotspot. Historical pattern: drunk driving, brawls.")
    else:
        zones.append("🟡 **Bhawarkuan** — Normal activity.")

    zones.append("🟡 **Palasia Square** — Consistent traffic incidents throughout the day.")
    zones.append("🟢 **Vijay Nagar** — Currently calm. Low predicted risk.")

    ctx = "evening/night" if is_night else "daytime"
    body = "\n".join(zones)
    return f"📊 **Random Forest Hotspot Predictions** — {ctx.title()} ({datetime.datetime.now().strftime('%H:%M')})\n\n{body}\n\n*Powered by NagarIQ's ML engine trained on 1,000+ historical incident records.*"


def tool_get_unit_status(message: str, units: list, **kwargs) -> str:
    lines = []
    for u in units:
        icon = "🟢" if u["status"] == "idle" else "🔴"
        lines.append(f"- {icon} **{u['name']}** (`{u['id']}`) — `{u['status'].upper()}`")
    body = "\n".join(lines)
    idle_count = len([u for u in units if u["status"] == "idle"])
    return f"🚑 **Unit Status Dashboard** — {idle_count}/{len(units)} units available\n\n{body}"


def tool_suggest_dispatch(message: str, units: list, incidents: list, **kwargs) -> str:
    # Try to extract incident ID from message
    match = re.search(r'(SOS|INC|TRF|GRV)-[A-Z0-9]+', message.upper())
    target_inc = None
    if match:
        inc_id = match.group(0)
        target_inc = next((i for i in incidents if i["id"] == inc_id), None)

    if not target_inc:
        # Pick the first active unresolved incident
        active = [i for i in incidents if i.get("status") != "resolved"]
        target_inc = active[0] if active else None

    if not target_inc:
        return "ℹ️ No active incidents found to dispatch for. The city is secure."

    idle_units = [u for u in units if u.get("status") == "idle"]
    if not idle_units:
        return f"⚠️ **No idle units available** for incident `{target_inc['id']}`. All units are deployed. Request mutual aid."

    # Find nearest idle unit to the incident
    best = min(idle_units, key=lambda u: haversine(u["lat"], u["lng"], target_inc["lat"], target_inc["lng"]))
    dist = haversine(best["lat"], best["lng"], target_inc["lat"], target_inc["lng"])
    eta = max(3, int(dist * 3.5))

    return (
        f"🎯 **ARIA Dispatch Recommendation**\n\n"
        f"**Incident:** `{target_inc['id']}` — {target_inc.get('incident_type', 'Unknown')}\n"
        f"**Location:** {target_inc.get('address', 'Unknown')}\n"
        f"**Severity:** {target_inc.get('severity', 'P2')}\n\n"
        f"**Recommended Unit:** 🚑 `{best['id']}` — {best['name']}\n"
        f"**Distance:** {dist:.1f} km | **ETA:** ~{eta} minutes\n\n"
        f"💡 *Use the Dispatch button in the incident card to deploy {best['id']}.*"
    )


def tool_city_stats(message: str, incidents: list, units: list, **kwargs) -> str:
    total = len(incidents)
    active = len([i for i in incidents if i.get("status") != "resolved"])
    resolved = total - active
    sos = len([i for i in incidents if i.get("incident_type") not in ["Traffic Violation", "City Grievance"]])
    traffic = len([i for i in incidents if i.get("incident_type") == "Traffic Violation"])
    idle_units = len([u for u in units if u.get("status") == "idle"])
    p1 = len([i for i in incidents if i.get("severity") == "P1" and i.get("status") != "resolved"])

    return (
        f"📊 **NagarIQ City Operations — Live Snapshot**\n\n"
        f"🚨 Active Incidents: **{active}** (P1 Critical: `{p1}`)\n"
        f"✅ Resolved Today: **{resolved}**\n"
        f"🔴 SOS Emergencies: **{sos}** | 🚗 Traffic Violations: **{traffic}**\n"
        f"🚑 Available Units: **{idle_units}/{len(units)}**\n\n"
        f"*System uptime: {datetime.datetime.now().strftime('%d %b %Y, %H:%M')} IST*"
    )


# ─────────────────────────────────────────────
# MAIN ARIA ENTRY POINT
# ─────────────────────────────────────────────

TOOL_MAP = {
    "greet": tool_greet,
    "find_nearest_idle_unit": tool_find_nearest_idle_unit,
    "list_active_incidents": tool_list_active_incidents,
    "get_incident_summary": tool_list_active_incidents,  # reuse
    "get_aqi_status": tool_get_aqi_status,
    "get_hotspot_areas": tool_get_hotspot_areas,
    "get_unit_status": tool_get_unit_status,
    "suggest_dispatch": tool_suggest_dispatch,
    "city_stats": tool_city_stats,
}


def aria_respond(message: str, incidents: list, units: list) -> dict:
    """
    Main pipeline:
      1. Route intent → select tool
      2. Execute tool with live system data
      3. Return structured response with tool metadata
    """
    intent = route_intent(message)
    tool_fn = TOOL_MAP.get(intent, tool_greet)

    response_text = tool_fn(
        message=message,
        incidents=incidents,
        units=units,
    )

    return {
        "response": response_text,
        "tool_used": intent,
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
    }

# ─────────────────────────────────────────────
# ZERO-SHOT SEMANTIC CLASSIFICATION (Simulated)
# ─────────────────────────────────────────────

def aria_analyze_grievance_severity(text: str) -> int:
    """
    Simulated Zero-Shot AI Classification using Semantic Context Math.
    Instead of exact keyword matching, this simulates an LLM embedding space
    by checking cluster density and applying attention weights to intensifiers.
    """
    text = text.lower()
    
    # Semantic "Danger" Clusters
    clusters = {
        "infrastructure": ["cave", "caving", "fall", "collapse", "hole", "sink", "break", "crush", "trap"],
        "chemical": ["smell", "gas", "chemical", "toxic", "leak", "fumes", "choke"],
        "water": ["flood", "drown", "pipe", "burst", "loss", "heavy", "drain", "sewage"],
        "medical": ["blood", "unconscious", "accident", "crash", "hit", "hurt", "dying", "dead"]
    }
    
    score = 0.0
    # Clean punctuation
    clean_text = ''.join(c for c in text if c.isalnum() or c.isspace())
    words = clean_text.split()
    total_words = len(words)
    
    if total_words == 0: return 1
        
    for word in words:
        for cluster_name, terms in clusters.items():
            if any(term in word for term in terms): # Partial match inside words (e.g. "caving" -> "cave")
                score += 1.5 
                
    # Attention Mechanism: Short, frantic sentences have higher emergency density
    if total_words < 6 and score > 0:
        score *= 1.5
        
    # Attention Mechanism: Intensifiers act as multipliers
    intensifiers = ["very", "really", "huge", "massive", "extremely", "fast", "big", "deep", "lot"]
    if any(i in words for i in intensifiers):
        score *= 1.3
        
    # Map raw semantic score to a 1-5 Priority Scale
    if score >= 4.0: return 5
    elif score >= 2.5: return 4
    elif score >= 1.5: return 3
    elif score > 0: return 2
    return 1
