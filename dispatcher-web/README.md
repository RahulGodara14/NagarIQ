# 📡 NagarIQ Dispatcher-Web

The central command and control dashboard (ICCC) for city operators. It is a highly-responsive React Single Page Application (SPA), integrating multiple live mapping layers of traffic, environmental status, AI reports, and public camera feeds.

## 🏗️ Architecture & Stack

- **Framework**: `React` 19.2 (Functional Components, Hooks/Context)
- **Build Tool**: `Vite` 7.3 (Lightning-fast HMR and bundling)
- **Styling**: `Tailwind CSS v4`
- **Mapping**: `Leaflet.js` & `React-Leaflet` (OpenStreetMap standard)
- **Networking**: `Axios` (REST APIS) + Native `WebSockets` (Nagrik-Drishti video feed)
- **Icons**: `Lucide-React`

## ✨ Core Dashboard Layers

### 1. Unified Incident Feed
A real-time left-sidebar polling interface. Automatically displays active SOS reports from the citizen app.
- Incorporates dynamic visual markers based on severity (e.g., Red/Yellow bounding boxes).
- Contains real-time images (Base64 JPEG evidence) from citizen mobile submissions.
- Allows operators to perform adaptive unit-dispatch via the A* route simulations on the map.

### 2. Vayu AQI Visualization
- Connects to mock IoT environmental sensor arrays.
- Plots variable radius and colored circle markers (`React-Leaflet`) according to the live Air Quality Index (AQI).

### 3. Nagar-Gati Traffic Prediction
- Renders the AI LSTM traffic density forecast model.
- Highlights choke points across major Indore intersections overlaid automatically on the map.

### 4. Parivahan Live ANPR Feed
- Simulates an integrated CCTV network detecting stolen vehicles and speeding/helmet violations using computer vision (EasyOCR).
- Streams violation alerts instantly to the dashboard.
- Red pulsing map icons alert operators automatically to immediate threat detections.

### 5. City Health (Indore-311)
- Overlays public infrastructure grievances (Potholes, Lighting, Waste).
- Operators can review priority ratings driven by AI analysis from the backend pipeline.

### 6. Live Nagrik-Drishti Modal
- A dedicated floating modal component containing an HTML5 context renderer.
- Directly decodes and mounts base64 image frames forwarded via the FastAPI WebSocket relay hub (from the citizen mobile app).
- Displays status indicators and immediate video shutdown capabilities on disconnects.

## 🛠️ Local Setup & Commands

Ensure you have **Node 18+** installed prior to spinning up the web app.

### 1. Installation

```bash
npm install
```

### 2. Running Locally

Starts Vite's super-fast development server with Hot Module Replacement (HMR).
```bash
npm run dev
```

Navigate to **`http://localhost:5173`** inside your browser. Ensure the FastAPI backend server is also live on port `8000` to prevent incident fetching request errors.

### 3. Build

For production bundles:
```bash
npm run build
```
