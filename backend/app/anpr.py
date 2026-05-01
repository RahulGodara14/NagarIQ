"""
NagarIQ Parivahan: ANPR & Traffic Violation Simulation Engine
=============================================================
Simulates EasyOCR-based CCTV plate detection across Indore's major squares.
"""

import random
import string
import io
import base64
from datetime import datetime

# -------------------------------------------------------
# 1. INDORE CCTV CAMERA GRID (Real locations, Indore MP)
# -------------------------------------------------------
CCTV_CAMERAS = [
    {"id": "CAM-01", "name": "Vijay Nagar Chowk",    "lat": 22.7532, "lng": 75.8937, "zone": "North"},
    {"id": "CAM-02", "name": "Palasia Square",         "lat": 22.7207, "lng": 75.8776, "zone": "Central"},
    {"id": "CAM-03", "name": "Rajwada Chowk",          "lat": 22.7196, "lng": 75.8577, "zone": "Central"},
    {"id": "CAM-04", "name": "Regal Square",           "lat": 22.7211, "lng": 75.8801, "zone": "Central"},
    {"id": "CAM-05", "name": "LIG Square",             "lat": 22.7408, "lng": 75.8818, "zone": "North"},
    {"id": "CAM-06", "name": "Geetabhavan Chowk",      "lat": 22.7283, "lng": 75.8845, "zone": "Central"},
    {"id": "CAM-07", "name": "Bijalpur Square",        "lat": 22.6834, "lng": 75.8397, "zone": "South"},
    {"id": "CAM-08", "name": "Chhawni Chowk",          "lat": 22.7156, "lng": 75.8698, "zone": "Central"},
    {"id": "CAM-09", "name": "Banganga Chowk",         "lat": 22.7329, "lng": 75.8700, "zone": "North"},
    {"id": "CAM-10", "name": "Scheme No. 54 Chowk",   "lat": 22.7465, "lng": 75.8997, "zone": "East"},
]

# -------------------------------------------------------
# 2. STOLEN VEHICLE DATABASE (Mock — NCRB integration point)
# -------------------------------------------------------
STOLEN_VEHICLE_DB = {
    "MP09CA1234", "MP09AB5678", "MP09XZ9900",
    "MP09QR4422", "MP09MN7733", "MH12DE1234",
    "GJ05AB9876", "DL8CAF0001",
}

# -------------------------------------------------------
# 3. VIOLATION TYPES WITH WEIGHTS
# -------------------------------------------------------
VIOLATION_TYPES = [
    ("Speeding",          0.35),
    ("Red Light Jump",    0.25),
    ("No Helmet",         0.20),
    ("Triple Riding",     0.10),
    ("Wrong Way",         0.10),
]

# -------------------------------------------------------
# 4. PLATE GENERATOR (Indian format: MH12DE1234)
# -------------------------------------------------------
STATE_CODES = ["MP09", "MP10", "MP07", "MH12", "GJ05", "RJ14", "DL8C", "UP32"]

def generate_plate() -> str:
    """Generate a random Indian-format vehicle registration plate."""
    state = random.choice(STATE_CODES)
    letters = "".join(random.choices(string.ascii_uppercase, k=2))
    digits = str(random.randint(1000, 9999))
    return f"{state}{letters}{digits}"

# -------------------------------------------------------
# 5. PLATE IMAGE GENERATOR + EASYOCR SIMULATION
# -------------------------------------------------------
def generate_plate_image_b64(plate_text: str) -> str:
    """
    Generates a realistic license plate image and runs EasyOCR on it.
    Returns the image as a base64 string (for the dispatcher UI).
    Uses Pillow to draw the plate; falls back to a plain text image.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        # Create a standard Indian plate: yellow background, black text
        w, h = 320, 90
        img = Image.new("RGB", (w, h), color=(30, 32, 40))  # dark bg

        # Outer border
        draw = ImageDraw.Draw(img)
        draw.rectangle([4, 4, w-4, h-4], outline=(56, 189, 248), width=2)

        # Plate area (white rect in center)
        draw.rectangle([14, 14, w-14, h-14], fill=(240, 240, 220))

        # Try to draw text
        try:
            font = ImageFont.truetype("arial.ttf", 36)
            small_font = ImageFont.truetype("arial.ttf", 11)
        except Exception:
            font = ImageFont.load_default()
            small_font = font

        # Plate number
        bbox = draw.textbbox((0, 0), plate_text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((w - tw) // 2, (h - th) // 2 - 4), plate_text, fill=(10, 10, 10), font=font)

        # State label
        draw.text((18, 16), "INDIA", fill=(20, 20, 200), font=small_font)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        # Minimal fallback — return a grey placeholder data URL
        return ""


def ocr_read_plate(plate_text: str) -> str:
    """
    Runs EasyOCR on the generated plate image to simulate real OCR detection.
    Minor noise is injected to mimic real-world OCR errors.
    """
    try:
        import easyocr
        from PIL import Image, ImageDraw, ImageFont
        import numpy as np

        # Build the plate image as a numpy array
        w, h = 320, 90
        img = Image.new("RGB", (w, h), (240, 240, 220))
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("arial.ttf", 36)
        except Exception:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), plate_text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((w - tw) // 2, (h - th) // 2), plate_text, fill=(10, 10, 10), font=font)

        arr = np.array(img)
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        results = reader.readtext(arr, detail=0)
        raw = "".join(results).replace(" ", "").upper()
        return raw if raw else plate_text  # fallback to original on failure
    except Exception:
        # EasyOCR unavailable or failed — return plate with occasional noise
        if random.random() < 0.1:  # 10% chance of OCR mis-read
            chars = list(plate_text)
            idx = random.randint(0, len(chars) - 1)
            chars[idx] = random.choice(string.ascii_uppercase + string.digits)
            return "".join(chars)
        return plate_text


# -------------------------------------------------------
# 6. MAIN SCAN FUNCTION — Called by the API endpoint
# -------------------------------------------------------
def simulate_anpr_scan(camera_id: str) -> dict | None:
    """
    Simulates one ANPR scan event on a given camera.
    Returns a violation dict, or None if nothing detected (clean pass).
    ~60% chance of detecting a violation per scan call.
    """
    if random.random() > 0.60:
        return None  # Clean pass — no violation

    camera = next((c for c in CCTV_CAMERAS if c["id"] == camera_id), None)
    if not camera:
        return None

    # Generate the plate, run simulated OCR, check stolen DB
    real_plate = generate_plate()

    # 5% chance this is a stolen vehicle — use one from the DB
    is_stolen = random.random() < 0.05
    if is_stolen:
        real_plate = random.choice(list(STOLEN_VEHICLE_DB))
        violation_type = "STOLEN VEHICLE ALERT"
    else:
        weights = [w for _, w in VIOLATION_TYPES]
        violation_type = random.choices([v for v, _ in VIOLATION_TYPES], weights=weights, k=1)[0]

    ocr_plate = ocr_read_plate(real_plate)
    plate_image = generate_plate_image_b64(ocr_plate)
    is_in_stolen_db = ocr_plate in STOLEN_VEHICLE_DB or real_plate in STOLEN_VEHICLE_DB

    confidence = round(random.uniform(0.82, 0.99), 2)

    return {
        "camera_id":      camera["id"],
        "camera_name":    camera["name"],
        "lat":            camera["lat"],
        "lng":            camera["lng"],
        "zone":           camera["zone"],
        "plate_detected": ocr_plate,
        "violation_type": violation_type,
        "is_stolen":      is_in_stolen_db or is_stolen,
        "confidence":     confidence,
        "plate_image":    plate_image,
        "timestamp":      datetime.utcnow().isoformat(),
    }
