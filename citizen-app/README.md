# 📱 NagarIQ Citizen Mobile Application

The **NagarIQ Citizen App** is the public-facing mobile gateway for smart city residents. It empowers citizens to raise instant emergency alarms, stream live video to dispatchers, report non-emergency civic grievances, check government welfare scheme eligibility, and maintain a secure digital citizen ID.

---

## 🏗️ Architecture & Stack

- **Framework**: `React Native 0.81`
- **Platform & SDK**: `Expo SDK ~54` (Managed Workflow)
- **Networking**: `Axios` (REST) + Native `WebSocket` client for live video frames
- **Hardware Integrations**:
  - `expo-camera`: Live camera video frame streaming
  - `expo-image-picker`: Incident photo evidence capture
  - `expo-location`: High-accuracy GPS geocoding
  - `expo-secure-store`: Hardware-backed encrypted JWT credential storage

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js 18+** installed.
- Install the **Expo Go** app on your physical mobile phone:
  - [Expo Go for Android (Google Play)](https://play.google.com/store/apps/details?id=host.exp.exponent)
  - [Expo Go for iOS (App Store)](https://apps.apple.com/app/expo-go/id982107779)
  *(Or use an Android Emulator / iOS Simulator).*

---

### 2. Installation

Navigate into the `citizen-app` directory and install dependencies:
```bash
cd citizen-app
npm install
```

---

### 3. Configure Backend Connection (Crucial Step!)

When running on a physical mobile device, `localhost` refers to the *phone itself*, not your computer.

1. Find your computer's local Wi-Fi IPv4 address:
   - **Windows**: Run `ipconfig` in PowerShell (look for `IPv4 Address`, e.g., `192.168.1.15`).
   - **macOS / Linux**: Run `ifconfig` or `ip a` (e.g., `192.168.1.15`).
2. Open `citizen-app/App.js` and set your computer's IP address:
   ```javascript
   const BACKEND_IP = "192.168.1.15"; // Replace with your computer's actual Wi-Fi IP
   const API_BASE = `http://${BACKEND_IP}:8000/api/v1`;
   ```

---

### 4. Start the Application

```bash
npx expo start -c
```

1. A **QR code** will appear in your terminal.
2. Open the **Expo Go** app on your Android device (or your camera on iOS) and scan the QR code.
3. The app will bundle and load directly on your mobile device!

---

## ✨ Citizen Features

### 1. 🚨 Zero-Friction SOS Dispatch
- Tap the central Emergency SOS button.
- Select emergency type or speak/type brief details.
- Automatically captures current GPS coordinates and attaches optional photo evidence.
- Pushes directly into the ICCC Dispatcher dashboard in <1 second.

### 2. 🛡️ Suraksha (Live Camera Video Relay)
- In high-danger situations, tap **Live Video Feed**.
- Streams real-time camera frames over WebSockets directly to the dispatcher console so operators can assess the threat live.

### 3. 🏛️ Indore-311 (Civic Health Reporting)
- Report potholes, broken streetlights, water leaks, or uncollected garbage.
- Automatically geolocates the grievance and submits to municipal authorities.

### 4. 📋 Nagrik AI Scheme Eligibility
- Enter basic demographic details (age, occupation, income level).
- Recommends eligible Central and State welfare programs (e.g., PM Awas Yojana, Ayushman Bharat, Ladli Behna).

### 5. 🪪 NagrikID Digital Document Vault
- Simulates secure Aadhaar-based authentication.
- Stores identity tokens securely using hardware keychain encryption (`expo-secure-store`).
