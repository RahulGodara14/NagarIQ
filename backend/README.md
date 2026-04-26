# 🧠 NagarIQ Backend: AI Engine & API Integrations

The Python backend is the intelligent command center for NagarIQ, handling real-time data ingestion, AI-model inference, video streams, and API routing using the highly performant `FastAPI` framework.

## 🏗️ Architecture & Stack

- **Framework**: `FastAPI` (ASGI async web server via `uvicorn`)
- **Database**: SQLite with `SQLAlchemy` ORM
- **Auth**: JWT (JSON Web Tokens) with `bcrypt` password hashing for DPDP (Digital Personal Data Protection Act) compliance.
- **AI Libraries**: `torch`, `transformers` (Hugging Face), `numpy`, `easyocr` (PyTorch)

## ✨ Core Backend Features

### 1. NLP Emergency Classification
An automated pipeline processing citizen 911/SOS inputs using a fine-tuned **DistilBERT** (Hugging Face) model.
- Automatically tags reports as: `Fire, Flood, Medical, Robbery, Traffic Violation, Other`.
- Designed for low-latency (<80ms) multi-class text classification running on a CPU.

### 2. Live Video Hub (Nagrik-Drishti)
A real-time base64 WebSockets stream hub.
- Handles multiple incoming citizen camera connections.
- Seamlessly broadcasts zero-latency frames to multiple connected dispatcher endpoints.

### 3. Indore-311 (Grievance Processor)
A sophisticated non-emergency issue reporting module.
- Logs structural reports (e.g. Broken Streetlights or Potholes).
- Employs deterministic AI prioritization (1 to 5) based on severity keywords like "dangerous" or "urgent".

### 4. Custom LSTM Neural Network Traffic Simulator
The *Nagar-Gati* system processes historical traffic density data.
- Built from scratch utilizing `torch.nn.LSTM` memory cells.
- Predicts rolling 30-minute traffic volume at multiple city junctions to optimize ambulance dispatch.

### 5. Parivahan Plate Detector (EasyOCR)
A high-accuracy Optical Character Recognition simulation utilizing computer vision.
- Renders dummy images of Indian license plates using `Pillow`.
- Scans streams continuously and extracts alphanumeric patterns via `easyocr`.
- Cross-references the results with a mock NCRB stolen vehicle watchlist and issues automated alerts.

## 🛠️ Local Development & Setup

Make sure you are running **Python 3.11+** within a virtual environment.

### 1. Requirements

Ensure your virtual environment is activated, then install dependencies:
```bash
pip install fastapi "uvicorn[standard]" sqlalchemy pydantic geopy pyjwt python-dotenv passlib[bcrypt]
pip install torch transformers easyocr pillow numpy requests
```

### 2. Running the Server

Start the application with hot-reloading:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Database Sync

The database (`nagariq.db`) is generated via SQLAlchemy. To manually force a sync run:
```python
python -c "from app.database import engine; from app import models; models.Base.metadata.create_all(bind=engine)"
```

The server natively exposes a Swagger OpenAPI UI document view at `http://localhost:8000/docs`.
