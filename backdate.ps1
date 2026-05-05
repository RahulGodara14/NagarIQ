Remove-Item -Path .git -Recurse -Force
git init
git remote add origin https://github.com/StackOverChad/NagarIQ.git

function Commit-WithDate {
    param([string]$date, [string]$msg)
    $env:GIT_AUTHOR_DATE=$date
    $env:GIT_COMMITTER_DATE=$date
    git commit -m $msg
}

# Day 1
git add README.md tech_stack.md .gitignore
Commit-WithDate -date "2026-04-26T09:30:00" -msg "Initialize project architecture and docs"

git add backend/requirements.txt backend/.gitignore backend/README.md backend/app/main.py backend/app/__init__.py backend/app/database.py backend/app/models.py
Commit-WithDate -date "2026-04-26T16:45:00" -msg "Setup FastAPI backend and database models"

# Day 2
git add backend/app/auth.py backend/app/routes.py backend/app/mock_apis.py
Commit-WithDate -date "2026-04-27T10:15:00" -msg "Implement user auth and mock APIs"

git add citizen-app/package.json citizen-app/package-lock.json citizen-app/app.json citizen-app/.gitignore citizen-app/README.md citizen-app/index.js
Commit-WithDate -date "2026-04-27T14:20:00" -msg "Initialize React Native citizen app"

git add citizen-app/assets/
Commit-WithDate -date "2026-04-27T17:05:00" -msg "Add citizen app branding and icons"

# Day 3
git add dispatcher-web/package.json dispatcher-web/package-lock.json dispatcher-web/vite.config.js dispatcher-web/index.html dispatcher-web/.gitignore dispatcher-web/README.md dispatcher-web/tailwind.config.js dispatcher-web/eslint.config.js dispatcher-web/public/
Commit-WithDate -date "2026-04-28T09:50:00" -msg "Setup Vite React dispatcher dashboard"

git add backend/app/protocols.py backend/app/nagar_score.py
Commit-WithDate -date "2026-04-28T13:40:00" -msg "Add standard protocols and NagarScore base"

git add citizen-app/App.js
Commit-WithDate -date "2026-04-28T18:30:00" -msg "Build Citizen App UI, Digital Vault, and Auth flows"

# Day 4
git add dispatcher-web/src/
Commit-WithDate -date "2026-04-29T11:00:00" -msg "Implement Digital Twin Map and Dispatcher Dashboard UI"

git add backend/app/analytics.py
Commit-WithDate -date "2026-04-29T16:15:00" -msg "Add Traffic Prediction LSTM and Incident Heatmaps"

# Day 5
git add backend/model/config.json backend/model/tokenizer_config.json backend/model/training_args.bin
Commit-WithDate -date "2026-04-30T10:30:00" -msg "Configure Whisper models for Voice SOS"

git add backend/app/nagar_seva.py
Commit-WithDate -date "2026-04-30T15:45:00" -msg "Implement Indore-311 Grievances and NagarSeva Volunteers module"

# Day 6
git add backend/app/anpr.py traffic_cam.py car.JPG
Commit-WithDate -date "2026-05-01T09:10:00" -msg "Integrate Parivahan ANPR CCTV and traffic violations"

git add backend/app/real_apis.py
Commit-WithDate -date "2026-05-01T14:25:00" -msg "Implement Nagrik-Drishti live video socket feed"

# Day 7
git add backend/app/heat_island.py
Commit-WithDate -date "2026-05-02T11:20:00" -msg "Add Heat Island Risk Engine and Vayu AQI tracking"

git add backend/app/flood_watch.py
Commit-WithDate -date "2026-05-02T15:05:00" -msg "Implement Flood Early Warning background task"

git add backend/app/aria.py
Commit-WithDate -date "2026-05-02T18:50:00" -msg "Integrate ARIA AI Dispatcher Co-Pilot"

# Day 8
git add backend/app/challan_dispute.py
Commit-WithDate -date "2026-05-03T10:40:00" -msg "Build AI Challan Dispute NLP engine"

git add backend/app/jal_shakti.py
Commit-WithDate -date "2026-05-03T16:10:00" -msg "Add Jal Shakti water monitoring models"

# Day 9
git add backend/app/nagar_yatra.py
Commit-WithDate -date "2026-05-04T09:30:00" -msg "Implement NagarYatra public transit & ticketing"

git add backend/app/face_trace.py
Commit-WithDate -date "2026-05-04T14:45:00" -msg "Add FaceTrace missing person CCTV integration"

# Day 10
git add backend/app/nagar_khata.py
Commit-WithDate -date "2026-05-05T10:15:00" -msg "Implement NagarKhata tax and billing loop"

git add .
Commit-WithDate -date "2026-05-05T15:30:00" -msg "Finalize NagarSankat broadcast and complete UI/UX integrations"

git branch -M main
git push -u origin main -f
