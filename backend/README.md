# 🧠 NagarIQ Backend: AI Engine & API Integrations

The Python backend is the intelligent command center for NagarIQ. It orchestrates real-time incident triage, automated emergency dispatch, IoT telemetry ingestion, and geospatial coordination using **FastAPI** (Python 3.11+).

---

## 🏗️ Architecture Overview

- **Framework**: `FastAPI` + `uvicorn` (Asynchronous ASGI server)
- **Database**: `SQLAlchemy` ORM with automated SQLite (`nagariq.db`) and PostgreSQL support
- **Auth**: JWT (JSON Web Tokens) with `bcrypt` password hashing (DPDP Act compliant)
- **IoT Background Tasks**: Asynchronous event loops for flood thresholds, water quality monitoring, heat island regression, and transit telemetry
- **APIs**: Native OpenStreetMap (OSM) hospital data, OSRM road routing, OpenWeatherMap live AQI/rain, and bidirectional WebSockets

---

## 🚀 Quick Setup & Local Run

### 1. Prerequisites
- **Python 3.11 or higher** installed. Check your version:
  ```bash
  python --version
  ```

### 2. Create and Activate Virtual Environment

#### Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

#### macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

---

### 3. Install Dependencies

NagarIQ provides two installation modes depending on your system:

#### Mode A: Production & Cloud-Optimized (Recommended)
Fast install (~15 seconds), uses **<100MB RAM**, runs reliably on any machine or free cloud host:
```bash
pip install -r requirements.txt
```

#### Mode B: Heavy AI / Local GPU Mode (Optional)
If you have a dedicated GPU and 16GB+ RAM and want to run the raw local HuggingFace transformers, PyTorch, and DeepFace models locally:
```bash
pip install -r requirements-heavy-ai.txt
```

---

### 4. Configure Environment (Optional)

Create a `.env` file in the `backend/` directory if you wish to override default settings:

```env
# Database URL (Defaults to local SQLite nagariq.db if left blank)
DATABASE_URL=sqlite:///./nagariq.db

# JWT Encryption Secret
SECRET_KEY=efa87f6a2fc92755be05e3c3b59253cd15e77d848cbb4b139334f578940e78a5

# Free OpenWeatherMap API Key (For live AQI and rainfall data)
OPENWEATHER_API_KEY=c115e9fb67a38d51d7c0847cc688fa81
```

---

### 5. Run the Server

From the project root:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Or from inside the `backend/` directory:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📖 Interactive API Documentation

Once the server is running, navigate to:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc UI**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

You can execute live requests, view request/response schemas, and test every endpoint directly in your browser.

---

## 🔌 Major API Modules & Endpoints

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **SOS** | `/api/v1/sos` | `POST` | Ingests emergency request, reverse-geocodes coords, classifies into 8 categories, assigns SOP protocols, broadcasts to WebSockets. |
| **Incidents** | `/api/v1/incidents` | `GET` | Fetches active incidents with severity filter (P1/P2/P3). |
| **Routing** | `/api/v1/routing/units` | `GET` | Live locations and statuses of Police, Fire, and Ambulance units. |
| **Routing** | `/api/v1/routing/path` | `POST` | Calculates real-road turn-by-turn route using OSRM. |
| **Parivahan**| `/api/v1/anpr/scan` | `GET` | Simulates CCTV plate scan, detects stolen cars and traffic violations. |
| **FaceTrace**| `/api/v1/facetrace/search`| `POST` | Matches missing person photo across 12 Indore CCTV nodes. |
| **Jal Shakti**| `/api/v1/water/status` | `GET` | Real-time water reservoir telemetry, turbidity, pH, and pump status. |
| **Flood** | `/api/v1/flood/sensors` | `GET` | River levels, rainfall sensors, and warning threshold states. |
| **Heat** | `/api/v1/heat/zones` | `GET` | Micro-climate heat index and mortality risk alerts. |
| **WebSockets**| `/ws` | `WS` | Live bidirectional event stream for the ICCC dispatch console. |

---

## 🗄️ Database Management

The SQLite database (`nagariq.db`) is automatically initialized with all tables on first startup.

To manually re-create or inspect tables:
```bash
python -c "from backend.app.database import engine; from backend.app import models; models.Base.metadata.create_all(bind=engine); print('Database tables verified!')"
```
