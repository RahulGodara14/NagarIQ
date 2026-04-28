"""
🎯 NagarScore Gamification Engine — NagarIQ Smart City OS
=========================================================
Tracks citizen engagement points, badges, and tiers.
Converts real-world civic actions into digital XP.
"""

import uuid
from sqlalchemy.orm import Session
from app.models import CitizenProfile

# The point value of different civic actions
ACTION_POINTS = {
    "REPORT_POTHOLE": 25,
    "VERIFIED_CHALLAN": 50,
    "NAGARSEVA_DUTY": 100,
    "PAY_TAX_ON_TIME": 200,
    "WATER_LEAK_REPORT": 30
}

def _calculate_tier(score: int) -> str:
    if score >= 2500: return "Platinum"
    if score >= 1000: return "Gold"
    if score >= 500: return "Silver"
    return "Bronze"

def init_seed_data_if_empty(db: Session):
    """Seed the database with initial gamification data if empty."""
    if db.query(CitizenProfile).first() is not None:
        return
        
    initial_profiles = [
        {"id": "CIT-001", "name": "Rahul Sharma", "score": 1250, "tier": "Gold", "badges": "Traffic Hero,Early Adopter", "avatar": "👨🏽"},
        {"id": "CIT-002", "name": "Priya Patel", "score": 3400, "tier": "Platinum", "badges": "Jal Shakti Guardian,NagarSeva EMT,Top 1%", "avatar": "👩🏽‍⚕️"},
        {"id": "CIT-003", "name": "Amit Verma", "score": 850, "tier": "Silver", "badges": "Pothole Spotter", "avatar": "👨🏻‍💻"},
        {"id": "CIT-004", "name": "Sneha Singh", "score": 2100, "tier": "Gold", "badges": "Green Warrior,Tax Payer", "avatar": "👩🏽‍🏫"},
        {"id": "CIT-005", "name": "Vikram Chouhan", "score": 420, "tier": "Bronze", "badges": "", "avatar": "👨🏽‍🎓"},
        {"id": "CIT-006", "name": "Anjali Gupta", "score": 2800, "tier": "Platinum", "badges": "Women Safety Escort,Traffic Hero", "avatar": "👩🏽‍💼"},
        {"id": "CIT-007", "name": "You (Citizen)", "score": 150, "tier": "Bronze", "badges": "Welcome", "avatar": "👤"}
    ]
    
    for p in initial_profiles:
        db.add(CitizenProfile(**p))
    db.commit()

def _format_profile(db_profile: CitizenProfile):
    return {
        "id": db_profile.id,
        "name": db_profile.name,
        "score": db_profile.score,
        "tier": db_profile.tier,
        "badges": db_profile.badges.split(",") if db_profile.badges else [],
        "avatar": db_profile.avatar
    }

def get_leaderboard(db: Session, limit=10):
    """Return top citizens sorted by score from DB."""
    init_seed_data_if_empty(db)
    top_citizens = db.query(CitizenProfile).order_by(CitizenProfile.score.desc()).limit(limit).all()
    return [_format_profile(c) for c in top_citizens]

def get_citizen_profile(db: Session, citizen_id: str):
    """Get profile and rank of a specific citizen from DB."""
    init_seed_data_if_empty(db)
    c_profile = db.query(CitizenProfile).filter(CitizenProfile.id == citizen_id).first()
    if not c_profile:
        return None
        
    # Calculate rank dynamically
    higher_scores = db.query(CitizenProfile).filter(CitizenProfile.score > c_profile.score).count()
    rank = higher_scores + 1
    
    total_citizens = db.query(CitizenProfile).count()
    
    profile_dict = _format_profile(c_profile)
    return {
        **profile_dict,
        "rank": rank,
        "total_citizens": total_citizens * 1000 # Mock city population scale
    }

def add_points(db: Session, citizen_id: str, action: str):
    """Award points for a civic action directly to DB."""
    init_seed_data_if_empty(db)
    
    c_profile = db.query(CitizenProfile).filter(CitizenProfile.id == citizen_id).first()
    if not c_profile:
        return {"status": "error", "message": "Citizen not found"}
        
    points = ACTION_POINTS.get(action, 10)
    c_profile.score += points
    c_profile.tier = _calculate_tier(c_profile.score)
    
    db.commit()
    db.refresh(c_profile)
    
    return {
        "status": "success",
        "points_awarded": points,
        "new_total": c_profile.score,
        "new_tier": c_profile.tier,
        "action": action
    }
