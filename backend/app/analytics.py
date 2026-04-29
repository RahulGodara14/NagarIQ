import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import random

# Indore roughly:
# Lat: 22.65 to 22.78
# Lng: 75.80 to 75.95
LAT_MIN, LAT_MAX = 22.65, 22.78
LNG_MIN, LNG_MAX = 75.80, 75.95

_model = None

def train_hotspot_model():
    """
    Trains a Random Forest model on generated historical data to predict crime/incident heatmap intensity.
    """
    global _model
    print("🌲 Training Random Forest Crime Hotspot Model...")
    
    # 1. Generate Fake Historical Data (1000 rows)
    data = []
    for _ in range(1000):
        lat = random.uniform(LAT_MIN, LAT_MAX)
        lng = random.uniform(LNG_MIN, LNG_MAX)
        hour = random.randint(0, 23)
        day_of_week = random.randint(0, 6)
        
        # Make certain areas artificially hot
        # Area 1: Rajwada (22.7180, 75.8540) is hot at night (20-23)
        # Area 2: Bhawarkuan (22.6950, 75.8680) is hot on weekends
        risk = 0.1
        
        # Distance to Rajwada
        dist_rajwada = ((lat - 22.7180)**2 + (lng - 75.8540)**2)**0.5
        if dist_rajwada < 0.02 and hour >= 18:
            risk += 0.8
            
        # Distance to Bhawarkuan
        dist_bk = ((lat - 22.6950)**2 + (lng - 75.8680)**2)**0.5
        if dist_bk < 0.02 and day_of_week >= 5:
            risk += 0.7
            
        # General noise
        risk += random.uniform(0, 0.2)
        risk = min(1.0, risk)
        
        data.append([lat, lng, hour, day_of_week, risk])
        
    df = pd.DataFrame(data, columns=['lat', 'lng', 'hour', 'day_of_week', 'risk'])
    
    X = df[['lat', 'lng', 'hour', 'day_of_week']]
    y = df['risk']
    
    # Train the regressor
    _model = RandomForestRegressor(n_estimators=50, max_depth=5, random_state=42)
    _model.fit(X, y)
    print("✅ Random Forest Hotspot Model initialized and trained!")

def get_hotspot_grid(current_hour: int, current_day: int):
    """
    Evaluates a 15x15 grid over Indore and returns the predicted risk weight for each cell.
    """
    global _model
    if _model is None:
        train_hotspot_model()
        
    hotspots = []
    
    # Create a grid
    grid_lat = np.linspace(LAT_MIN, LAT_MAX, 15)
    grid_lng = np.linspace(LNG_MIN, LNG_MAX, 15)
    
    # Batch predict for speed
    X_pred = []
    coords = []
    for lat in grid_lat:
        for lng in grid_lng:
            X_pred.append([lat, lng, current_hour, current_day])
            coords.append((lat, lng))
            
    predictions = _model.predict(X_pred)
    
    for i, pred_risk in enumerate(predictions):
        # We emphasize the contrast
        if pred_risk > 0.35:
            hotspots.append({
                "id": f"hotspot_{i}",
                "lat": float(coords[i][0]),
                "lng": float(coords[i][1]),
                "weight": float(pred_risk)
            })
                
    return hotspots
