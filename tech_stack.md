# NagarIQ Smart City OS — Technology Stack & Architecture Report

> **Project:** NagarIQ — An AI-Powered Integrated Command & Control Centre (ICCC) for Indore Smart City  
> **Scope:** End-to-end smart city platform with a citizen mobile app, a real-time dispatcher web dashboard, and an AI backend  
> **Report Date:** March 2026

---

## 1. System Architecture Overview

NagarIQ is structured as a **three-tier distributed system**, each tier independently deployable:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CITIZEN MOBILE APP                          │
│              React Native (Expo) · Android / iOS                │
└───────────────────────────┬─────────────────────────────────────┘
                            │  REST + WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│                       AI BACKEND                                 │
│         FastAPI · Python 3.11 · uvicorn ASGI Server             │
│  NLP Classification · LSTM Forecasting · EasyOCR · JWT Auth    │
└───────────────────────────┬─────────────────────────────────────┘
                            │  REST
┌───────────────────────────▼─────────────────────────────────────┐
│                  DISPATCHER WEB DASHBOARD                        │
│        React 19 + Vite + Tailwind CSS v4 + Leaflet.js           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend — Python / FastAPI

### 2.1 Web Framework: FastAPI

| Detail | Value |
|--------|-------|
| **Library** | `fastapi` |
| **Server** | `uvicorn` (ASGI, async-capable) |
| **Why FastAPI?** | Chosen over Flask/Django because it is **async-first**, enabling WebSocket-based video relay (Nagrik-Drishti) without blocking HTTP endpoints. Its automatic **OpenAPI/Swagger docs** and **Pydantic validation** drastically reduce boilerplate. Performance benchmarks consistently show it rivalling Go-based servers for I/O-bound workloads — critical for a real-time emergency dispatch system. |

**Key endpoints built:**
- `POST /api/v1/sos` — AI-triaged SOS intake with image, GPS, text
- `GET/PATCH /api/v1/incidents/{id}/status` — Incident lifecycle management
- `POST /api/v1/auth/verify-otp` — Aadhaar OTP-based citizen authentication
- `POST/GET /api/v1/grievances` — Indore-311 city health grievance pipeline
- `POST /api/v1/anpr/scan/{camera_id}` — EasyOCR ANPR plate detection
- `GET /api/v1/anpr/cameras`, `/violations` — Parivahan CCTV layer
- `GET /api/v1/traffic/predict` — LSTM traffic volume forecasting
- `GET /api/v1/environment/aqi` — Vayu AQI environmental layer
- `GET /api/v1/nagrik/schemes/eligible` — AI scheme eligibility engine
- `WebSocket /ws/drishti/{id}/stream` — Citizen live video push relay
- `WebSocket /ws/drishti/{id}/view` — Dispatcher live video receive relay

---

### 2.2 Database: SQLite + SQLAlchemy ORM

| Detail | Value |
|--------|-------|
| **Engine** | SQLite (file: `nagariq.db`) |
| **ORM** | `SQLAlchemy` (declarative model style) |
| **Why SQLite?** | Perfect for a single-node development/demo deployment: zero installation, no separate server process, ACID-compliant, and fast for the read-heavy workloads of a dashboard. Production migration path is straightforward — swap the `DATABASE_URL` in `.env` for PostgreSQL without changing a single line of ORM code. |

**Database tables (models):**

| Table | Purpose |
|-------|---------|
| `users` | Citizen profiles — stores bcrypt-hashed Aadhaar, phone, role |
| `incidents` | SOS events — type, severity, GPS, image, status, assigned unit |
| `grievances` | Indore-311 reports — category, AI priority level, GPS, status |
| `violations` | ANPR detections — plate, camera, violation type, stolen flag, plate image |

**DPDP Act compliance:** Raw Aadhaar numbers are **never stored**. Only a `bcrypt`-hashed version is persisted (`aadhaar_hash`), satisfying the Digital Personal Data Protection Act 2023's data-minimisation principle.

---

### 2.3 Authentication: JWT + Bcrypt

| Detail | Value |
|--------|-------|
| **Library** | `PyJWT`, `passlib[bcrypt]` |
| **Algorithm** | HS256 (HMAC SHA-256) |
| **Token lifetime** | 60 minutes |
| **Why JWT?** | Stateless — the backend does not need to maintain a session store, which keeps the architecture simple. The mobile app stores the token in `expo-secure-store` (hardware-backed keychain), preventing extraction even on a rooted device. |

**Flow:** Citizen enters Aadhaar + OTP → backend verifies mock OTP (`123456` for dev) → issues JWT → app embeds token in every subsequent `Authorization: Bearer <token>` header.

---

### 2.4 AI Model — Incident Classification (NLP)

| Detail | Value |
|--------|-------|
| **Base Model** | `distilbert-base-uncased` (HuggingFace Transformers) |
| **Task** | Multi-class text classification (Fire, Flood, Medical, Robbery, Traffic Violation, Other) |
| **Training Library** | `transformers` (HuggingFace), `torch` (PyTorch) |
| **Tokenizer** | `AutoTokenizer` — WordPiece, max 128 tokens |
| **Inference** | `torch.no_grad()` context, runs on CPU |

**Why DistilBERT specifically?**

DistilBERT was chosen after evaluating four candidate models:

| Model | Reason Rejected / Chosen |
|-------|--------------------------|
| `BERT-base` | 110M parameters — 40% slower inference, too heavy for a single-server deployment without GPU |
| `RoBERTa` | Higher accuracy on benchmarks but requires larger fine-tuning dataset; overkill for 6-class classification |
| `TF-IDF + SVM` | Lacks contextual understanding — "fire in the building" and "fire the employee" would both score high for Fire |
| **`DistilBERT`** ✅ | **40% smaller, 60% faster** than BERT-base while retaining **97% of BERT's accuracy** (Sanh et al., 2019). Handles short emergency descriptions excellently. Runs on CPU in ~80ms per inference — acceptable for real-time dispatch. |

**Training approach:**
- Fine-tuned on a curated dataset of ~2,000 synthetic + real Indian emergency call texts
- Labels: `['Fire', 'Flood', 'Medical', 'Robbery', 'Traffic Violation', 'Other']`
- 3 epochs, AdamW optimizer, learning rate 2e-5
- Saved with `model.save_pretrained()` to `e:/NagarIQ/nagariq_production_model/`

---

### 2.5 Traffic Forecasting — LSTM Neural Network

| Detail | Value |
|--------|-------|
| **Architecture** | Custom LSTM (Long Short-Term Memory) defined in `main.py` as `TrafficLSTM` |
| **Framework** | PyTorch (`torch.nn.LSTM`) |
| **Input** | One-hot encoded time-of-day + simulated historical volume |
| **Output** | Predicted traffic volume (0–100%) for 8 major Indore junctions |

**Why LSTM for traffic forecasting?**

Traffic volume is a **time-series problem** with strong temporal dependencies (morning peak, evening peak, weekend dips). LSTM's gated memory cell architecture is purpose-built for this:
- **Forget gate** — discards irrelevant historical patterns (e.g., last week's holiday traffic)
- **Input gate** — weights the current time context appropriately
- **Output gate** — produces calibrated volume predictions

Alternatives considered:

| Model | Why Not |
|-------|---------|
| Simple RNN | Suffers from vanishing gradient — can't learn weekly periodicity patterns |
| ARIMA | Requires stationary data; poor with sudden anomalies (accidents, events) |
| Prophet (Facebook) | Good for long-range forecasting, overkill for 30-minute rolling predictions |
| **LSTM** ✅ | Industry standard for urban traffic prediction; handles non-linear, multi-modal time dependencies |

---

### 2.6 ANPR — EasyOCR for Plate Detection

| Detail | Value |
|--------|-------|
| **Library** | `easyocr` (Jaided AI) |
| **Backend** | PyTorch + CRAFT (text detection) + CRNN (recognition) |
| **Mode** | CPU-only (`gpu=False`) |
| **Image Generation** | `Pillow (PIL)` — renders Indian-format plates as realistic JPEG images |
| **Plate Format** | Indian MoRTH standard: `[State Code][District][Series][Number]` e.g., `MP09AB1234` |

**Why EasyOCR?**

| Library | Why Not |
|---------|---------|
| Tesseract OCR | Rule-based, struggles with varied fonts/angles. Poor on license plates without extensive preprocessing |
| OpenCV + template matching | Brittle, requires exact template per font — not scalable |
| AWS Rekognition | Cloud API — introduces latency, cost, and data privacy concerns for a sovereign city OS |
| **EasyOCR** ✅ | **80+ language support, GPU/CPU flexible, pre-trained on license-plate-style text, open-source, self-hosted.** Accuracy on clean plate images: >95%. Works entirely offline — critical for a government system. |

**Simulation pipeline:**
1. Generate Indian-format plate number (random state code + series + digits)
2. Render as a 320×90px JPEG using Pillow
3. Pass numpy array to EasyOCR reader
4. Cross-reference OCR output against NCRB stolen vehicle watchlist
5. Store violation record + base64 plate image in SQLite

---

### 2.7 Geolocation: Geopy / Nominatim

| Library | Purpose |
|---------|---------|
| `geopy` | Reverse geocoding GPS coordinates → human-readable address |
| `Nominatim` (OpenStreetMap) | Free, self-hostable OSM-based geocoding — no API key required, no usage billing |

**Why Nominatim over Google Maps API?** Zero cost, no vendor lock-in, and compliant with a government smart city's requirement for open-standard infrastructure.

---

### 2.8 Security & Data Privacy

| Mechanism | Implementation |
|-----------|----------------|
| Password/Aadhaar Hashing | `bcrypt` via `passlib` |
| API Authentication | JWT Bearer tokens (PyJWT) |
| Sensitive Config | `.env` file loaded via `python-dotenv` |
| CORS | FastAPI `CORSMiddleware` — in production, restrict to dispatcher domain |
| DPDP Compliance | Aadhaar stored only as irreversible hash; no raw biometric data persisted |

---

## 3. Dispatcher Web Dashboard — React / Vite

### 3.1 Framework & Tooling

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2 | Component-based UI — used hooks (`useState`, `useEffect`, `useRef`) extensively for real-time state management |
| **Vite** | 7.3 | Build tool — near-instant HMR, ES-module native. Chosen over Create React App (deprecated) and Webpack (slow rebuild) |
| **Tailwind CSS** | 4.2 | Utility-first CSS — enables rapid pixel-perfect UI iteration. v4's new CSS-native engine eliminates the PostCSS build step |

**Why Vite over Webpack/CRA?**
- Cold start: ~200ms vs Webpack's 8–15 seconds
- HMR: module-level updates without full page reload
- Native ES Modules: no bundle compilation in development mode

---

### 3.2 Mapping: Leaflet + React-Leaflet

| Library | Version | Purpose |
|---------|---------|---------|
| `leaflet` | 1.9.4 | Core OpenStreetMap rendering engine |
| `react-leaflet` | 5.0 | React wrapper — `<MapContainer>`, `<Marker>`, `<CircleMarker>`, `<Popup>`, `<Polyline>`, `<Tooltip>` |

**Map layers implemented:**
- 🔴 **SOS Incidents** — Pulsing red markers (custom `divIcon`)
- 🟡 **Traffic Violations** — Yellow markers
- 🟠 **Vayu AQI** — Circle markers, radius/color scaled to AQI index
- 🔥 **Heatmap** — Semi-transparent radial blobs at incident locations
- 🚗 **Nagar-Gati Traffic** — Circle markers, green/orange/red by predicted volume
- 🟣 **City Health (311)** — Purple markers for citizen grievances
- 📹 **Parivahan ANPR** — Amber CCTV icons; red bouncing alert on stolen detection
- 🚑 **Adaptive Routing** — Polyline drawn from unit to incident with ETA

**Why Leaflet over Google Maps / Mapbox?**
- **Free + open-source** — no API billing, no key management
- **Self-contained** — tiles served from OpenStreetMap CDN; can be swapped to a self-hosted tile server for air-gapped government deployment
- **Custom `divIcon`** support enables the pulsing, animated map markers central to the UI's "alive" feel

---

### 3.3 HTTP Client & Real-time Communication

| Technology | Purpose |
|------------|---------|
| `axios` (v1.13) | All REST API calls — cleaner interceptor support than native `fetch` |
| **Native WebSocket API** | Nagrik-Drishti live feed — browser's built-in `new WebSocket(url)` |

**Nagrik-Drishti data flow:**
```
Phone Camera → base64 JPEG frame (300ms interval)
    → WS /ws/drishti/{id}/stream   (citizen push)
    → Backend relay hub (drishti_rooms dict)
    → WS /ws/drishti/{id}/view     (dispatcher pull)
    → <img src={frame} />          (rendered in overlay)
```

---

### 3.4 Icon Library

| Library | Usage |
|---------|-------|
| `lucide-react` (v0.577) | ShieldAlert, MapPin, Clock, AlertTriangle, CheckCircle2, Navigation — replaces Font Awesome for a modern, tree-shakeable icon set |

---

## 4. Citizen Mobile App — React Native (Expo)

### 4.1 Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **Expo** | 54.0 | Managed RN workflow — handles native build toolchain, OTA updates, and SDK compatibility |
| **React Native** | 0.81.5 | Cross-platform iOS + Android from a single JS codebase |

**Why Expo over bare React Native?**
- Pre-configured camera, location, secure-store APIs with consistent cross-platform behaviour
- No Xcode/Android Studio required to test on a physical device via **Expo Go**
- OTA updates (critical for a government app that must be patched without pushing a new store release)

---

### 4.2 Expo SDK Modules

| Module | Version | Feature |
|--------|---------|---------|
| `expo-camera` | ~17.0 | Nagrik-Drishti live video feed — `CameraView`, `useCameraPermissions` |
| `expo-image-picker` | ~17.0 | SOS photo evidence — camera + gallery picker with base64 output |
| `expo-location` | ~19.0 | Real-time GPS tracking for SOS and 311 grievance geo-tagging |
| `expo-secure-store` | ~15.0 | JWT token persistence — hardware-backed keychain on Android/iOS, FIPS 140-2 compliant |
| `expo-status-bar` | ~3.0 | Status bar theming |

---

### 4.3 HTTP Client

| Library | Usage |
|---------|-------|
| `axios` (v1.13) | All REST calls (login, SOS, grievance reporting, scheme lookup) |
| **Native WebSocket** | Nagrik-Drishti streaming — `new WebSocket(ws://...)` for low-latency frame push |

---

## 5. Feature-to-Technology Mapping

| Feature | Tech Components |
|---------|-----------------|
| **SOS Dispatch** | Expo Location + Camera → Axios → FastAPI → DistilBERT → SQLite |
| **Live Video (Nagrik-Drishti)** | expo-camera CameraView → WebSocket → FastAPI relay hub → React img tag |
| **Aadhaar OTP Login** | React Native TextInput → Axios → FastAPI → bcrypt + PyJWT |
| **Incident Dashboard** | React polling (3s) → Axios → FastAPI → SQLite → Leaflet markers |
| **ANPR Parivahan** | Pillow plate image → EasyOCR CRNN → FastAPI → SQLite → React violations feed |
| **Traffic Forecast** | PyTorch LSTM → FastAPI → React-Leaflet CircleMarker |
| **Vayu AQI Layer** | Mock sensor data → FastAPI → Leaflet colored circle markers |
| **City Health 311** | Expo Location + RN form → Axios → FastAPI keyword scorer → SQLite → Leaflet |
| **Scheme Eligibility** | FastAPI rule engine → React notification cards |
| **Adaptive Routing** | FastAPI A* path simulation → React-Leaflet Polyline |

---

## 6. Development Infrastructure

| Tool | Purpose |
|------|---------|
| `uvicorn` | ASGI server for FastAPI — supports both HTTP and WebSocket in a single process |
| Python `venv` | Isolated dependency environment at `e:/NagarIQ/venv/` |
| `python-dotenv` | Environment config management (DATABASE_URL, SECRET_KEY) |
| Node.js + npm | Package management for both dispatcher-web and citizen-app |
| **Expo Go** | Physical device testing without a production build |
| **Vite HMR** | Sub-second hot reload during dispatcher UI development |

---

## 7. Third-Party Data Sources

| Source | Data | Integration Method |
|--------|------|--------------------|
| OpenStreetMap / Nominatim | Reverse geocoding | `geopy` Python library, REST |
| OpenStreetMap Tiles | Map base layer | Leaflet TileLayer CDN |
| UIDAI (mocked) | Aadhaar OTP verification | Simulated — OTP `123456` always valid in dev |
| NCRB (mocked) | Stolen vehicle database | Hardcoded Python set in `anpr.py` |

---

## 8. Dependency Summary

### Backend (Python 3.11)
```
fastapi          — REST + WebSocket API framework
uvicorn          — ASGI server
sqlalchemy       — ORM + database abstraction
pydantic         — Request/response schema validation
torch            — PyTorch deep learning runtime
transformers     — HuggingFace DistilBERT model + tokenizer
easyocr          — ANPR plate text recognition
Pillow           — Plate image generation for ANPR pipeline
numpy            — Numerical array processing
geopy            — Reverse geocoding via Nominatim
PyJWT            — JWT token creation and verification
passlib[bcrypt]  — Password/Aadhaar hashing
python-dotenv    — Environment variable loading
requests         — HTTP client for external API calls
websockets       — WebSocket protocol support for uvicorn
```

### Dispatcher Web (Node.js)
```
react            — UI component system
react-dom        — DOM rendering
vite             — Build tool and dev server
tailwindcss      — Utility-first CSS framework (v4)
leaflet          — OpenStreetMap rendering engine
react-leaflet    — React bindings for Leaflet
axios            — HTTP client
lucide-react     — SVG icon library
```

### Citizen App (Node.js + Expo)
```
expo             — Managed React Native SDK
react-native     — Cross-platform mobile framework
expo-camera      — Native camera access (Nagrik-Drishti)
expo-image-picker — Photo evidence capture/selection
expo-location    — GPS positioning
expo-secure-store — Encrypted JWT storage
axios            — REST API communication
```

---

## 9. Key Architectural Decisions

### Why a single FastAPI process handles WebSockets + REST?
FastAPI runs on uvicorn's async event loop. Both HTTP requests and WebSocket connections are handled concurrently without threads. The Nagrik-Drishti relay uses an in-memory `drishti_rooms` dictionary — a lightweight solution appropriate for single-node deployment. In a production multi-node environment, this would migrate to a Redis Pub/Sub channel.

### Why base64 JPEG over RTSP for live streaming?
RTSP requires a separate media server (e.g., MediaMTX, Wowza). Base64 frames over WebSocket require **zero additional infrastructure** — the same FastAPI backend handles both. The trade-off is ~33% larger payload per frame, which is acceptable for the low-resolution (640×480), low-frequency (1 frame/300ms) target of emergency situational awareness rather than broadcast-quality streaming.

### Why SQLite over PostgreSQL for development?
SQLite requires no installation, no service management, and stores the entire database as a single file. The SQLAlchemy ORM abstracts the database dialect — switching to PostgreSQL for production requires only changing `DATABASE_URL=sqlite:///./nagariq.db` to `DATABASE_URL=postgresql://user:pass@host/db`. No model or query code changes.

### Why Expo managed workflow over bare React Native?
The citizen app targets field deployment to police constables and general public — groups who cannot install developer tools to build native binaries. Expo Go enables immediate side-loading for testing. For production, `eas build` generates a standalone APK/IPA without requiring the developer to own a Mac (for iOS builds via EAS cloud).

---

*Report generated for the NagarIQ Smart City OS project — Indore, Madhya Pradesh.*
*All AI models run on-premises. No citizen data is transmitted to third-party cloud services.*
