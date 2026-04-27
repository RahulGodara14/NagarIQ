# 📱 NagarIQ Citizen Mobile Application

The **NagarIQ Citizen App** serves as the primary gateway for public interaction with the Integrated Command and Control Centre (ICCC). Citizens can access vital civic services, raise emergency alarms, and track local environment metrics instantly.

## 🏗️ Architecture & Stack

- **Framework**: `React Native 0.81.5`
- **Compiler/SDK**: `Expo ~54.0.33` (Managed Workflow)
- **Networking**: `Axios` and native `WebSockets`
- **Device Sensors/APIs**: 
  - `expo-camera` (Video Streaming)
  - `expo-image-picker` (Photo Uploads)
  - `expo-location` (Background/Foreground GPS Tracking)
  - `expo-secure-store` (Hardware Keychain JWT token storage)

## ✨ Core Application Features

### 1. Zero-Friction SOS Dispatch (DistilBERT NLP)
- Intuitive SOS interface asking for brief details and photo evidence.
- Directly pings the Python Backend's **DistilBERT** NLP model to classify the emergency.
- Fetches the user's explicit coordinates via `expo-location` and bundles it in the payload to the Dispatcher Dashboard.

### 2. Nagrik-Drishti (Live Video Feed)
- Advanced real-time video streaming directly from the citizen’s hardware camera.
- Utilizes the WebSocket protocol (`ws://`) to bypass the limitations of REST for high-framerate media delivery.
- Relays base64-encoded frame dumps to the backend hub for dispatcher consumption.

### 3. Indore-311 (Civic Grievances)
- Simple "City Health" reporter module.
- Allows citizens to document missing infrastructure, open potholes, or uncollected garbage.
- Automatically captures current GPS location for the ICCC tracking maps.

### 4. Smart Scheme Eligibility (AI Engine)
- Form-driven interface taking demographic inputs (Age, Income, Occupation, Gender, State).
- Calls an intelligent rule-engine endpoint on the server to recommend specific civic welfare schemes immediately to the user.

### 5. Aadhaar-Mock Authentication
- The application securely simulates integration with UIDAI using "Aadhaar Hash".
- Encrypts the JWT output from the FastAPI backend into `expo-secure-store`.
- Ensures total privacy adherence complying with DPDP regulatory guidelines.

## 🛠️ Local Development & Expo Setting

**Requirements:** Node 18+ and ideally the **Expo Go** app on your physical mobile device.

### 1. Installation

Install all node dependencies.

```bash
npm install
```

### 2. Networking Setup

**Crucial Step:** Due to how mobile physical devices route IP traffic, `localhost` points to the *device*, not your computer's backend server.

Inside `App.js`, ensure you substitute `192.168.x.x` with your machine's exact local IPv4 Wi-Fi address.

```javascript
// App.js
const BACKEND_IP = "192.168.0.x";
const API_BASE = `http://${BACKEND_IP}:8000/api/v1`;
```

### 3. Running Expo Server

Start up the bundler compiler.
```bash
npx expo start -c
```

Scan the **QR code** generated in your terminal or browser (http://localhost:8081) using your mobile phone camera (iOS) or Expo Go App (Android).
