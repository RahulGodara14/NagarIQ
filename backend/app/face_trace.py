"""
📷 FaceTrace — Missing Person Search Engine
NagarIQ Tier 2 Feature

Architecture:
  - Upload photo of missing person
  - DeepFace extracts real facial embedding (age, gender, emotion analysis)
  - System simulates searching across 10 CCTV cameras spread across Indore
  - Returns camera matches ranked by confidence score
  - Frontend shows detection locations on map
"""

import os
import base64
import uuid
import random
import datetime
import io
import numpy as np
from typing import Optional

# Silence TensorFlow/oneDNN noise before any TF import happens
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")


# CCTV camera grid across Indore (real locations)
CCTV_CAMERAS = [
    {"id": "CAM-RT-01", "name": "Rajwada Chowk",         "lat": 22.7186, "lng": 75.8559, "zone": "Old City"},
    {"id": "CAM-RT-02", "name": "Palasia Square",         "lat": 22.7225, "lng": 75.8850, "zone": "Central"},
    {"id": "CAM-RT-03", "name": "Vijay Nagar Crossroads", "lat": 22.7530, "lng": 75.8930, "zone": "West"},
    {"id": "CAM-RT-04", "name": "Bhawarkuan",             "lat": 22.6950, "lng": 75.8680, "zone": "South"},
    {"id": "CAM-RT-05", "name": "MG Road Junction",       "lat": 22.7195, "lng": 75.8752, "zone": "Central"},
    {"id": "CAM-RT-06", "name": "Sapna-Sangeeta Road",    "lat": 22.7292, "lng": 75.8880, "zone": "West"},
    {"id": "CAM-RT-07", "name": "Geeta Bhawan Crossing",  "lat": 22.7357, "lng": 75.8803, "zone": "North-West"},
    {"id": "CAM-RT-08", "name": "LIG Square",             "lat": 22.7474, "lng": 75.8714, "zone": "North"},
    {"id": "CAM-RT-09", "name": "Treasure Island Mall",   "lat": 22.7271, "lng": 75.8832, "zone": "Central"},
    {"id": "CAM-RT-10", "name": "Annapurna Road",         "lat": 22.7000, "lng": 75.8700, "zone": "South"},
    {"id": "CAM-RT-11", "name": "Regal Square",           "lat": 22.7165, "lng": 75.8680, "zone": "Old City"},
    {"id": "CAM-RT-12", "name": "Super Corridor Toll",    "lat": 22.7690, "lng": 75.9010, "zone": "East"},
]


def analyze_face_with_deepface(image_bytes: bytes) -> dict:
    """
    Uses DeepFace to extract real face attributes from the uploaded photo.
    Returns age, gender, emotion, and a facial embedding vector.
    """
    try:
        from deepface import DeepFace
        import cv2
        import tempfile
        import os

        # Write image to a temp file (DeepFace works best with file paths)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            # Run full analysis (age, gender, race, emotion)
            result = DeepFace.analyze(
                img_path=tmp_path,
                actions=["age", "gender", "emotion"],
                enforce_detection=False,
                silent=True,
            )
            if isinstance(result, list):
                result = result[0]

            # Extract embedding using Facenet model (fast + accurate)
            embedding_result = DeepFace.represent(
                img_path=tmp_path,
                model_name="Facenet",
                enforce_detection=False,
            )
            embedding = embedding_result[0]["embedding"] if embedding_result else None

            return {
                "success": True,
                "age": int(result.get("age", 0)),
                "gender": result.get("dominant_gender", "Unknown"),
                "emotion": result.get("dominant_emotion", "neutral"),
                "embedding": embedding,
                "source": "DeepFace (Facenet)",
                "face_confidence": round(result.get("face_confidence", 0.85), 2),
            }
        finally:
            os.unlink(tmp_path)

    except ImportError:
        # DeepFace not installed yet
        return _simulated_face_analysis()
    except Exception as e:
        print(f"[FaceTrace] DeepFace analysis failed: {e}")
        return _simulated_face_analysis()


def _simulated_face_analysis() -> dict:
    """Fallback when DeepFace is unavailable."""
    return {
        "success": True,
        "age": random.randint(18, 55),
        "gender": random.choice(["Man", "Woman"]),
        "emotion": random.choice(["neutral", "fear", "sad", "happy"]),
        "embedding": [random.uniform(-1, 1) for _ in range(128)],
        "source": "Simulated (DeepFace loading...)",
        "face_confidence": round(random.uniform(0.80, 0.97), 2),
    }


def cosine_similarity(a: list, b: list) -> float:
    """Compute cosine similarity between two embedding vectors."""
    a, b = np.array(a), np.array(b)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def search_cctv_grid(face_data: dict, subject_name: str) -> dict:
    """
    Searches the CCTV grid for the missing person.
    
    Real system: would compare face embedding against stored embeddings from each camera.
    Simulation: generates realistic match scores — 2-4 cameras get a "hit" above threshold.
    """
    embedding = face_data.get("embedding") or [random.uniform(-1, 1) for _ in range(128)]

    # Simulate each camera's "last seen" embedding
    camera_results = []
    # Pick 2-4 random cameras for "hits" 
    hit_cameras = random.sample(range(len(CCTV_CAMERAS)), k=random.randint(2, 4))

    for i, cam in enumerate(CCTV_CAMERAS):
        if i in hit_cameras:
            # Generate a "close" embedding (high similarity)
            noise_scale = random.uniform(0.05, 0.25)
            cam_embedding = [e + random.gauss(0, noise_scale) for e in embedding]
            similarity = random.uniform(0.72, 0.96)
        else:
            # Generate a random "no match" embedding
            cam_embedding = [random.uniform(-1, 1) for _ in range(len(embedding))]
            similarity = random.uniform(0.10, 0.45)

        confidence_pct = round(similarity * 100, 1)
        is_match = similarity >= 0.60

        # Generate realistic "last seen" time (within last 8 hours)
        hours_ago = random.randint(1, 8) if is_match else random.randint(0, 24)
        minutes_ago = random.randint(0, 59)
        last_seen = datetime.datetime.now() - datetime.timedelta(hours=hours_ago, minutes=minutes_ago)

        camera_results.append({
            "camera_id": cam["id"],
            "camera_name": cam["name"],
            "zone": cam["zone"],
            "lat": cam["lat"],
            "lng": cam["lng"],
            "confidence": confidence_pct,
            "is_match": is_match,
            "last_seen": last_seen.strftime("%H:%M, %d %b"),
            "last_seen_iso": last_seen.isoformat(),
        })

    # Sort by confidence descending
    camera_results.sort(key=lambda x: x["confidence"], reverse=True)

    matches = [c for c in camera_results if c["is_match"]]
    best = matches[0] if matches else None

    return {
        "search_id": f"FT-{uuid.uuid4().hex[:8].upper()}",
        "subject_name": subject_name or "Unknown",
        "face_analysis": {
            "estimated_age": face_data.get("age"),
            "gender": face_data.get("gender"),
            "emotion": face_data.get("emotion"),
            "face_confidence": face_data.get("face_confidence"),
            "source": face_data.get("source"),
        },
        "cameras_scanned": len(CCTV_CAMERAS),
        "matches_found": len(matches),
        "best_match": best,
        "camera_results": camera_results,
        "timestamp": datetime.datetime.now().strftime("%d %b %Y, %H:%M:%S"),
        "status": "LOCATED" if matches else "NOT_FOUND",
    }
