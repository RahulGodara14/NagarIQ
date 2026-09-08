# 🚀 NagarIQ Deployment Guide: Render (Backend) + Vercel (Frontend)

This guide walks you through deploying **NagarIQ** to the cloud completely for free:
- **Backend (FastAPI + WebSockets)**: Deployed on **[Render.com](https://render.com)**
- **Frontend (React + Leaflet ICCC Console)**: Deployed on **[Vercel.com](https://vercel.com)**

---

## 📌 Prerequisites
1. Your repository is pushed to GitHub: [https://github.com/RahulGodara14/NagarIQ](https://github.com/RahulGodara14/NagarIQ) (or `StackOverChad/NagarIQ`).
2. A free account on **[Render.com](https://render.com)**.
3. A free account on **[Vercel.com](https://vercel.com)**.

---

## 🛠️ Step 1: Deploy Backend on Render (5 minutes)

1. Go to **[dashboard.render.com](https://dashboard.render.com)** and log in.
2. Click the blue **"New +"** button at the top right and select **"Web Service"**.
3. Select **"Build and deploy from a Git repository"** and click **Next**.
4. Connect your GitHub account and select your **NagarIQ** repository.
5. Fill in the following settings:
   - **Name**: `nagariq-backend` (or your chosen name)
   - **Region**: Choose closest to you (e.g., `Singapore` or `Frankfurt` or `Oregon`)
   - **Branch**: `main`
   - **Root Directory**: `backend` *(⚠️ Important: must be `backend`)*
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: Select **Free** ($0/month)
6. Scroll down to **Environment Variables** and add:
   | Key | Value |
   | :--- | :--- |
   | `PYTHON_VERSION` | `3.11.9` |
   | `SECRET_KEY` | `efa87f6a2fc92755be05e3c3b59253cd15e77d848cbb4b139334f578940e78a5` |
   | `OPENWEATHER_API_KEY` | `c115e9fb67a38d51d7c0847cc688fa81` |
   | `TF_ENABLE_ONEDNN_OPTS` | `0` |
   | `TF_CPP_MIN_LOG_LEVEL` | `2` |
   *(Note: If you want to use Render's free PostgreSQL, create a PostgreSQL service on Render and paste its Internal Database URL into `DATABASE_URL`. Otherwise, the backend automatically uses the built-in SQLite database `nagariq.db`).*
7. Click **"Deploy Web Service"**.
8. Wait 2–3 minutes for the build to finish. Once live, Render will give you a public URL, for example:
   ```
   https://nagariq-backend.onrender.com
   ```
   👉 **Copy this URL!** You will need it for Vercel in Step 2.

---

## ⚡ Step 2: Deploy Frontend on Vercel (2 minutes)

1. Go to **[vercel.com/dashboard](https://vercel.com/dashboard)** and log in.
2. Click **"Add New..."** → **"Project"**.
3. Import your **NagarIQ** GitHub repository.
4. In the configuration screen:
   - **Project Name**: `nagariq` (or any name you prefer)
   - **Framework Preset**: `Vite` (auto-detected)
   - **Root Directory**: Click **Edit** and select `dispatcher-web` *(⚠️ Critical!)*
5. Expand the **Environment Variables** section and add:
   | Name | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://nagariq-backend.onrender.com` *(Paste your Render URL from Step 1)* |
   | `VITE_WS_URL` | `wss://nagariq-backend.onrender.com` *(Same URL with `wss://`)* |
6. Click **"Deploy"**.
7. Vercel will build and publish your site in ~30 seconds and provide your live URL:
   ```
   https://nagariq.vercel.app
   ```

---

## ✅ Step 3: Verify Your Live Site

Open your Vercel URL (`https://your-project.vercel.app`):
- [x] The National Tricolor ribbon and Government ICCC header load.
- [x] Live IST Clock ticks in real-time.
- [x] All 11 GIS layers (AQI, Traffic, Hotspots, Transit, MedETA, FloodWatch, etc.) fetch data from your live Render backend.
- [x] Nagrik-Drishti WebSocket video stream connects securely over `wss://`.
- [x] ARIA AI Co-Pilot chat responds live.

---

## 🔄 Automatic Deployments

Both Render and Vercel are connected to your GitHub repository:
- Whenever you push new commits to `main` on GitHub:
  - **Render** automatically rebuilds and redeploys the backend.
  - **Vercel** automatically rebuilds and redeploys the frontend.
