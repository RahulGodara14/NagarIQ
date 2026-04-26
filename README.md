# 🏛️ NagarIQ Smart City OS

**NagarIQ** is an AI-Powered Integrated Command & Control Centre (ICCC) designed for smart cities. It features a complete end-to-end ecosystem comprising a citizen mobile application, a real-time web dispatch dashboard for control room operators, and a fully featured AI-backend powering both.

## 🏗️ System Architecture

NagarIQ operates as a **three-tier distributed system**, where each component is loosely coupled and independently scalable.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CITIZEN MOBILE APP                          │
│              React Native (Expo) · Android / iOS                │
└───────────────────────────┬─────────────────────────────────────┘
                            │  REST + WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│                       AI BACKEND                                │
│         FastAPI · Python 3.11 · uvicorn ASGI Server             │
│  NLP Classification · LSTM Forecasting · EasyOCR · JWT Auth     │
└───────────────────────────┬─────────────────────────────────────┘
                            │  REST
┌───────────────────────────▼─────────────────────────────────────┐
│                  DISPATCHER WEB DASHBOARD                       │
│        React 19 + Vite + Tailwind CSS v4 + Leaflet.js           │
└─────────────────────────────────────────────────────────────────┘
```

The system is designed for high-performance and real-time operations, leveraging asynchronous Python (FastAPI + Websockets) to seamlessly relay video and data streams while keeping resource usage light.

---

## ✨ Core Ecosystem Features

### 1. AI-Triaged Emergency SOS Dispatch
- Citizens can report text, image, and location details via the mobile app.
- The backend utilizes a fine-tuned **DistilBERT** NLP model to instantly classify the emergency (Fire, Flood, Medical, Robbery, Traffic, Other).
- Incidents appear dynamically on the Dispatcher Map as pulsing red alert markers.

### 2. Nagrik-Drishti (Live Video Streaming)
- A low-latency video relay system powered by **WebSockets**.
- Citizens can activate a live video feed from their phone camera directly into the ICCC dashboard for maximum situational awareness for the dispatcher.

### 3. Parivahan ANPR (Automatic Number Plate Recognition)
- Simulates CCTV integrations across city intersections.
- Runs **EasyOCR** (PyTorch) to dynamically detect license plates.
- Cross-references plates against a stolen-vehicle DB and creates automated traffic violation alerts (Speeding, No Helmet, Red Light Jump) on the map.

### 4. Nagar-Gati (AI Traffic Forecasting)
- Uses a custom PyTorch **LSTM (Long Short-Term Memory) Neural Network** to predict traffic volume 30-minutes into the future across key city junctions.
- Informs the adaptive pathfinding algorithm for dispatching emergency units.

### 5. Indore-311 (City Health Grievances)
- Citizens can report non-emergency infrastructure issues (Potholes, broken streetlights, unattended garbage).
- The system visually layers these as "City Health" markers on the map for civic authorities to address.

### 6. Dynamic Vayu AQI Layer & Civic Schemes
- A dedicated map layer that plots real-time Environmental Air Quality Index metrics.
- Citizens can input their demographics into the mobile app to get AI-driven recommendations for relevant civic schemes.

---

## 📁 Repository Structure

- **`/backend`**: The Python FastAPI AI server, data storage (`nagariq.db`), and background inference pipelines. (See `backend/README.md`)
- **`/dispatcher-web`**: The Vite + React web interface for ICCC operators and dashboard visualization. (See `dispatcher-web/README.md`)
- **`/citizen-app`**: The Expo React Native application for public access and emergency reporting. (See `citizen-app/README.md`)
- **`tech_stack.md`**: Detailed technical breakdown and rationale for architectural decisions across the organization.

## 🚀 Quick Start Guide

1. Start the Backend (`uvicorn app.main:app --reload`)
2. Start the Dispatcher Dashboard (`npm run dev`)
3. Start the Citizen Mobile Application (`npx expo start -c`)

Please refer to each directory's respective `README.md` for complete environment setup and local run instructions.
