# 📡 NagarIQ Dispatcher-Web (ICCC Console)

The central command and control dashboard for municipal dispatchers, operators, and emergency responders. Built in compliance with Indian Government Website Guidelines (GIGW) and MoHUA standards.

---

## 🏗️ Architecture & Stack

- **Framework**: `React 19` (Modern functional components, hooks)
- **Build System**: `Vite 7` (High-speed Hot Module Replacement)
- **Styling**: `Tailwind CSS` with GIGW government palette (Ashoka Navy, Saffron, Emerald)
- **2D Mapping**: `Leaflet.js` & `react-leaflet` with OpenStreetMap CartoDB dark tiles
- **3D Digital Twin**: `CesiumJS` with building elevations, terrain, and AQI fog
- **AI Co-Pilot**: `ARIA AI` tactical assistant with Speech Synthesis
- **Networking**: `Axios` + native `WebSocket` stream (`/ws`)

---

## 🚀 Quick Start (Local Run)

### 1. Prerequisites
- **Node.js 18+** installed. Check your version:
  ```bash
  node -v
  ```

### 2. Installation
Navigate to the `dispatcher-web` directory:
```bash
cd dispatcher-web
npm install
```

### 3. Environment Variables (Optional)
The dashboard automatically connects to `http://127.0.0.1:8000` by default. 

To point to a custom backend or production server, create a `.env.local` file:
```env
VITE_API_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000

# Optional: Add a Cesium Ion token for 3D terrain
VITE_CESIUM_TOKEN=
```

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🎛️ Dashboard Feature Walkthrough

### 1. Tactical Incident Feed (Left Sidebar)
- Real-time incoming SOS alerts classified into P1 (Critical), P2 (Major), and P3 (Minor).
- Filter by domain: **Medical**, **Fire**, **Police**, or **Civic**.
- Click any incident card to auto-center the map, inspect evidence photos, read official SOP checklists, and assign nearest emergency units.

### 2. GIS Tactical Toolbar (Top Center)
Toggle domain-specific geospatial layers on the fly:
- **🌿 Vayu AQI**: Hyper-local air quality index sensor circles across city wards.
- **🔥 Crime/Risk Hotspots**: Kernel density heatmaps of high-incident areas.
- **🌡️ Heat Index**: Micro-climate heat mortality stress zones.
- **🚗 Parivahan**: CCTV camera feeds with real-time ANPR plate detections and challan logs.
- **🌊 FloodWatch**: River water sensor polygons with real-time danger thresholds.
- **🏥 MedETA Hospitals**: Real-world hospitals with live available emergency/ICU bed counts.
- **🚌 NagarYatra Transit**: Real-time Indore iBus public transit locations.
- **🎒 VidyaTrack**: School bus tracking and student route geofencing.

### 3. 🌐 3D Digital Twin (CesiumJS)
Click **"3D VIEW"** in the top navigation bar to launch the full-screen 3D Cesium globe of Indore.
- View 3D building extrusions and terrain topography.
- Real-time animated unit movement (Ambulances, Police, Fire).
- Dynamic AQI fog layer based on current ambient air quality.
- Switch between 3D Perspective and 2D Top-Down views.

### 4. 🤖 ARIA AI Municipal Co-Pilot
Click the floating **ARIA AI** button in the bottom-right corner:
- Tactical voice-assisted operational guidance.
- Ask questions like: *"Find nearest available ambulance to Rajwada"*, *"What is the SOP for chemical fire?"*, or *"Show high AQI zones"*.
- Speech synthesis and instant protocol execution.

---

## 📦 Production Build

To build the static production bundle for Vercel, Netlify, or any static web host:
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory.

To test the production build locally:
```bash
npm run preview
```
