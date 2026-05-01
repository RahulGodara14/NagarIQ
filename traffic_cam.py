import easyocr
import cv2
import re
import requests
import warnings

# Suppress annoying PyTorch warnings
warnings.filterwarnings("ignore", category=UserWarning)

print("Loading NagarIQ Vision Model (EasyOCR)...")
# Initialize the AI to read English text, forcing it to use your CPU
reader = easyocr.Reader(['en'], gpu=False)

image_path = 'car.jpg'
print(f"Scanning image: {image_path} for speeding violations...\n")

try:
    # 1. AI reads all the text it can find in the picture
    results = reader.readtext(image_path)
    
    detected_plates = []
    
    # 2. Filter the text to find things that look like Indian license plates
    for (bbox, text, prob) in results:
        # Remove spaces, dashes, and special characters
        clean_text = re.sub(r'[^A-Z0-9]', '', text.upper())
        
        # Indian plates are generally 8 to 11 characters long (e.g., DL8CAF5030)
        if 8 <= len(clean_text) <= 11:
            detected_plates.append((clean_text, prob))

    if not detected_plates:
        print("❌ No license plate detected in this image. Is the photo clear?")
    else:
        # Grab the detection with the highest AI confidence score
        best_plate, confidence = max(detected_plates, key=lambda x: x[1])
        
        print("=========================================")
        print(f"🚨 SPEEDING VIOLATION DETECTED 🚨")
        print(f"License Plate : {best_plate}")
        print(f"AI Confidence : {round(confidence * 100, 2)}%")
        print("=========================================\n")

        # 3. Ping the NagarIQ Backend to cross-reference the Parivahan Database
        print("Checking National Parivahan Database...")
        backend_url = f"http://127.0.0.1:8000/mock/parivahan/challans/{best_plate}"
        
        response = requests.get(backend_url)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Match Found!")
            print(f"Owner Name       : {data['owner_name']}")
            print(f"Vehicle Class    : {data['vehicle_class']}")
            print(f"Pending Challans : {data['pending_challans']}")
            print(f"\n[ACTION] Auto-generating 2000 INR Speeding E-Challan for {data['owner_name']}...")
            
            # --- NEW: SEND ALERT TO ICCC DASHBOARD ---
            print("📡 Transmitting data to NagarIQ ICCC Dashboard...")
            
            # Convert the car image to a format the dashboard can read
            import base64
            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                base64_image = f"data:image/jpeg;base64,{encoded_string}"

            # We'll use a coordinate slightly offset from your SOS test in Indore
            payload = {
                "vehicle_number": best_plate,
                "lat": 22.7250, 
                "lng": 75.8650,
                "image_base64": base64_image
            }
            
            dashboard_response = requests.post("http://127.0.0.1:8000/api/v1/traffic/violation", json=payload)
            if dashboard_response.status_code == 200:
                print("✅ Traffic violation successfully logged on Dispatcher Map!")
                
        else:
            print("⚠️ Vehicle not found in the mock Parivahan database.")

except Exception as e:
    print(f"Error processing image: {e}")