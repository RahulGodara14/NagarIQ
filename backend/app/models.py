# E:\NagarIQ\backend\app\models.py
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Integer, Text
from .database import Base
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    aadhaar_hash = Column(String, unique=True, index=True) # Storing hash for DPDP compliance
    name = Column(String)
    phone = Column(String, unique=True, index=True)
    blood_group = Column(String, nullable=True)
    role = Column(String, default="citizen") # roles: citizen, dispatcher, admin

class CitizenProfile(Base):
    """Gamification and reputation data for citizens."""
    __tablename__ = "citizen_profiles"
    
    id = Column(String, primary_key=True, index=True) # e.g. CIT-001
    name = Column(String)
    score = Column(Integer, default=0)
    tier = Column(String, default="Bronze")
    badges = Column(String, default="") # Comma-separated list of badges
    avatar = Column(String, default="👤")

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True) # e.g., INC-0001
    caller_id = Column(Integer)
    incident_type = Column(String, default="unclassified")
    description = Column(Text, nullable=True)
    severity = Column(String, default="pending") # P1, P2, P3
    lat = Column(Float)
    lng = Column(Float)
    address = Column(String, nullable=True)
    image_data = Column(Text, nullable=True)
    status = Column(String, default="active") # active, dispatched, resolved
    assigned_unit = Column(String, nullable=True) # e.g., "Ambulance-12", "Patrol-05"
    timestamp = Column(DateTime, default=datetime.utcnow)

class Grievance(Base):
    __tablename__ = "grievances"
    id = Column(String, primary_key=True, index=True)
    citizen_id = Column(Integer)
    category = Column(String) # Pothole, Street Light, Garbage, Sewerage, etc.
    description = Column(Text)
    priority = Column(Integer, default=1) # 1 to 5 (Calculated by AI)
    lat = Column(Float)
    lng = Column(Float)
    address = Column(String, nullable=True)
    status = Column(String, default="pending") # pending, field_inspection, resolved
    timestamp = Column(DateTime, default=datetime.utcnow)

class ViolationRecord(Base):
    __tablename__ = "violations"
    id = Column(String, primary_key=True, index=True)       # e.g. VIO-XXXX
    camera_id = Column(String)                               # CAM-01 etc.
    camera_name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    zone = Column(String)
    plate_detected = Column(String)
    violation_type = Column(String)                          # Speeding, No Helmet, STOLEN etc.
    is_stolen = Column(Integer, default=0)                   # 0/1 flag
    confidence = Column(Float)
    plate_image = Column(Text, nullable=True)                # base64 data URI
    timestamp = Column(DateTime, default=datetime.utcnow)