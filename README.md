# 🏛️ NagarIQ: Next-Gen AI Smart City Operating System (ICCC)

> **Autonomous Integrated Command, Control & Emergency Response System for Modern Municipalities**

[![Live Frontend](https://img.shields.io/badge/Vercel-Live%20Dashboard-black?logo=vercel)](https://nagar-iq.vercel.app/)
[![Backend API](https://img.shields.io/badge/FastAPI-Production%20Ready-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![GIS 3D](https://img.shields.io/badge/CesiumJS-Digital%20Twin-1d4ed8?logo=cesium)](https://cesium.com/)
[![Government Standards](https://img.shields.io/badge/Standard-MoHUA%20%2F%20GIGW%20Compliant-16a34a)](#)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python)](https://python.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)

---

## 🌟 What is NagarIQ?

**NagarIQ** is an enterprise-grade **Integrated Command and Control Centre (ICCC)** operating system built according to the standards of the Ministry of Housing and Urban Affairs (MoHUA) and Guidelines for Indian Government Websites (GIGW). 

It connects citizens, civic departments, and emergency dispatchers into a single, unified real-time operations center.

### 🌐 Live Deployment
- **Dispatcher Web Dashboard**: [https://nagar-iq.vercel.app/](https://nagar-iq.vercel.app/)
- **Backend API**: Deployed on Render with automated health checks and Swagger UI at `/docs`.

---

## 🏗️ System Architecture

NagarIQ is designed as a **3-tier distributed, resilient architecture**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CITIZEN MOBILE APP                              │
│                React Native (Expo) · Android / iOS                     │
│    Voice SOS · Live Video Relay · Grievance Filing · NagrikID Vault    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST + WebSocket
┌───────────────────────────────────▼────────────────────────────────────┐
│                             AI BACKEND                                 │
│                FastAPI · Python 3.11 · uvicorn ASGI                    │
│   Emergency Triage · Traffic LSTM · ANPR OCR · IoT Sensors · GIS APIs  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST + Real-time WebSockets
┌───────────────────────────────────▼────────────────────────────────────┐
│                    DISPATCHER WEB DASHBOARD (ICCC)                     │
│                React 19 + Vite + Tailwind CSS + CesiumJS               │
│     Tactical GIS Map · 3D Digital Twin · ARIA AI Co-Pilot · Telematics │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

| Domain | Feature | Description |
| :--- | :--- | :--- |
| 🚨 **Emergency** | **Intelligent SOS Dispatch** | Multi-class NLP classification across 8 incident categories (*Medical, Fire, Road Accident, Crime, Disaster, Domestic Violence, Missing Person, Infrastructure*) with auto-assigned Standard Operating Procedures (SOPs). |
| 🌐 **Geospatial** | **3D Digital Twin (CesiumJS)** | 3D city visualization of Indore with building models, real-time vehicle telematics, ward polygons, and dynamic AQI fog rendering. |
| 🤖 **AI Assistant** | **ARIA AI Co-Pilot** | Voice-enabled tactical assistant offering dispatchers situational guidance, unit recommendations, and inter-agency coordination. |
| 🚗 **Mobility** | **Parivahan ANPR & Traffic** | Automatic Number Plate Recognition simulation across 10 CCTV squares with automated traffic challans and stolen-vehicle NCRB database alerts. |
| 💧 **Utilities** | **Jal Shakti & FloodWatch** | IoT water pipeline monitoring, turbidity/pH sensing, and river level flood alert sensors with automated P1 notifications. |
| 🌡️ **Environment** | **Heat Island & Vayu AQI** | Micro-climate Rothfusz heat stress index calculations and live AQI environmental mapping via OpenWeatherMap. |
| 🚌 **Transit & Safety** | **NagarYatra & VidyaTrack** | Public bus fleet tracking (Indore iBus) and smart school bus geofence tracking for student safety. |
| 🏛️ **Civic Life** | **Indore-311 & NagarKhata** | Non-emergency civic issue reporting (potholes, garbage, lights) + municipal property tax & utility billing ledger. |

---

## 🚀 Quick Start Guide (Run Locally in 5 Minutes)

### 📋 Prerequisites

Before running NagarIQ, ensure you have installed:
1. **Python 3.11+** ([Download Python](https://www.python.org/downloads/))
2. **Node.js 18+ & npm** ([Download Node.js](https://nodejs.org/))
3. **Git** ([Download Git](https://git-scm.com/))

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/RahulGodara14/NagarIQ.git
cd NagarIQ
```

---

### Step 2: Start the AI Backend Server

Open a new terminal window in the project root:

#### Windows (PowerShell):
```powershell
# Create virtual environment (first time only)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r backend/requirements.txt

# Start the FastAPI server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### macOS / Linux (Bash):
```bash
# Create virtual environment (first time only)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install required dependencies
pip install -r backend/requirements.txt

# Start the FastAPI server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

> [!TIP]
> Once running, open **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)** in your browser to explore and test the interactive Swagger API documentation!

---

### Step 3: Start the Dispatcher Web Dashboard

Open a second terminal window:

```bash
cd dispatcher-web

# Install frontend dependencies (first time only)
npm install

# Start the Vite development server
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser to view the ICCC dashboard.

---

### Step 4: (Optional) Start the Citizen Mobile App

Open a third terminal window:

```bash
cd citizen-app

# Install Expo & mobile dependencies (first time only)
npm install

# Start the Expo development bundler
npx expo start -c
```

Scan the QR code displayed in your terminal using the **Expo Go** app on your iOS or Android mobile phone.

> [!IMPORTANT]
> When running the mobile app on a physical phone, update `BACKEND_IP` in `citizen-app/App.js` to your computer's local Wi-Fi IP address (e.g., `192.168.1.5`) instead of `localhost`.

---

## 📁 Repository Directory Structure

```text
NagarIQ/
├── backend/                  # FastAPI Python backend
│   ├── app/                  # Application code (main.py, models, auth, engines)
│   ├── requirements.txt      # Production cloud requirements (<100MB RAM)
│   ├── requirements-heavy-ai.txt # Heavy AI requirements (PyTorch/Transformers)
│   └── README.md             # Backend detailed guide
├── dispatcher-web/           # ICCC Web Dispatcher Single Page App
│   ├── src/                  # React components, Digital Twin, Leaflet GIS, ARIA
│   ├── package.json          # Node dependencies
│   ├── vercel.json           # Vercel SPA routing rules
│   └── README.md             # Frontend detailed guide
├── citizen-app/              # Citizen Mobile Application (Expo / React Native)
│   ├── App.js                # Mobile views, SOS, video streaming, NagrikID
│   ├── package.json          # React Native dependencies
│   └── README.md             # Mobile detailed guide
├── render.yaml               # Render Cloud Blueprint for automatic backend deployment
├── RENDER_VERCEL_GUIDE.md    # Detailed production cloud hosting walkthrough
└── README.md                 # This overview guide
```

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`):
Create a file named `.env` inside the `backend/` directory (optional; default SQLite fallback works out of the box):

```env
# Database (Defaults to SQLite nagariq.db if omitted)
DATABASE_URL=sqlite:///./nagariq.db

# JWT Security
SECRET_KEY=your_super_secret_jwt_key_here

# OpenWeatherMap API Key (Free tier for live AQI and rainfall)
OPENWEATHER_API_KEY=your_openweathermap_api_key_here
```

### Frontend (`dispatcher-web/.env.local`):
Create a file named `.env.local` inside `dispatcher-web/` (optional; defaults to localhost):

```env
# Backend API & WebSocket URLs
VITE_API_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000

# Optional Cesium Ion Token for photorealistic 3D terrain
VITE_CESIUM_TOKEN=your_cesium_ion_token_here
```

---

## 🧪 Testing & Sample Credentials

### Quick API Test (PowerShell):
Generate a test JWT token with mock Aadhaar verification:
```powershell
$body = '{"aadhaar_number": "123456789123", "phone": "9876543210", "otp": "123456"}'
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/auth/verify-otp" -Method Post -ContentType "application/json" -Body $body
```

### Trigger a Sample SOS Emergency:
```powershell
$sos = '{"lat": 22.7196, "lng": 75.8577, "channel": "MOBILE_APP", "description": "Fire broken out in central commercial complex near Rajwada"}'
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/sos" -Method Post -ContentType "application/json" -Body $sos
```
*Observe the instant live alert on the Dispatcher Dashboard map at `http://localhost:5173`!*

---

## ☁️ Deployment Guide

For full step-by-step instructions on deploying the backend to **Render** and the frontend to **Vercel**, check out [`RENDER_VERCEL_GUIDE.md`](./RENDER_VERCEL_GUIDE.md).

---

## 🤝 Contributing & License

Contributions, issues, and feature requests are welcome!
Licensed under the [MIT License](./LICENSE).
