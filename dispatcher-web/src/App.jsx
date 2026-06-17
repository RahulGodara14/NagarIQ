import { useEffect, useState, useRef, lazy, Suspense } from 'react';
const DigitalTwin = lazy(() => import('./DigitalTwin.jsx'));
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { ShieldAlert, MapPin, Clock, AlertTriangle, CheckCircle2, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip, Polyline, Polygon, useMapEvents, ZoomControl } from 'react-leaflet';
import HeatmapLayer from './HeatmapLayer.jsx';
// 1. The Red SOS Icon
const pulsingRedIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-5 h-5 bg-red-600 rounded-full border-2 border-white animate-ping absolute -left-2.5 -top-2.5"></div>
         <div class="w-5 h-5 bg-red-600 rounded-full border-2 border-white absolute -left-2.5 -top-2.5"></div>`,
  iconSize: [0, 0],
});

// 2. The Yellow Traffic Icon
const pulsingYellowIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-5 h-5 bg-yellow-500 rounded-full border-2 border-white animate-ping absolute -left-2.5 -top-2.5"></div>
         <div class="w-5 h-5 bg-yellow-500 rounded-full border-2 border-white absolute -left-2.5 -top-2.5"></div>`,
  iconSize: [0, 0],
});

// 3. The Blue Ambulance Icon
const ambulanceIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-8 h-8 bg-blue-600 rounded-lg border-2 border-white flex items-center justify-center shadow-lg transform -rotate-45">
            <span class="text-white text-xs font-bold rotate-45">🚑</span>
         </div>`,
  iconSize: [32, 32],
});

// 3.5. The NagarSeva Volunteer Icon
const volunteerIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="relative flex h-4 w-4">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white shadow-[0_0_10px_rgba(59,130,246,0.8)]"></span>
         </div>`,
  iconSize: [16, 16],
});

// 4. The Purple Grievance Icon (Indore-311)
const grievanceIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-6 h-6 bg-purple-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
            <span class="text-white text-[10px] font-bold">🏗️</span>
         </div>`,
  iconSize: [24, 24],
});
// 5. CCTV Camera Icon (Parivahan ANPR)
const cctvIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-7 h-7 bg-amber-500 rounded-lg border-2 border-white flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.6)]">
            <span class="text-white text-[13px]">📹</span>
         </div>`,
  iconSize: [28, 28],
});
const cctvAlertIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-8 h-8 bg-red-600 rounded-lg border-2 border-white flex items-center justify-center shadow-[0_0_14px_rgba(239,68,68,0.8)] animate-bounce">
            <span class="text-white text-[13px]">🚨</span>
         </div>`,
  iconSize: [32, 32],
});

// 6. Hospital Icon (MedETA)
const hospitalIcon = (status) => L.divIcon({
  className: 'custom-icon',
  html: `<div class="flex flex-col items-center">
    <div class="w-9 h-9 rounded-xl border-2 flex items-center justify-center shadow-lg ${
      status === 'AVAILABLE' ? 'bg-emerald-600/90 border-emerald-300 shadow-emerald-500/50' :
      status === 'BUSY' ? 'bg-amber-500/90 border-amber-300 shadow-amber-500/50' :
      'bg-red-600/90 border-red-300 shadow-red-500/50'
    }">
      <span class="text-white text-lg font-black">🏥</span>
    </div>
  </div>`,
  iconSize: [36, 42],
  iconAnchor: [18, 42],
});

// 7. Government School Icon (VidyaTrack)
const schoolIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-7 h-7 bg-sky-500 rounded-lg border-2 border-white flex items-center justify-center shadow-[0_0_10px_rgba(14,165,233,0.6)]">
            <span class="text-white text-[14px]">🎓</span>
         </div>`,
  iconSize: [28, 28],
});

// 8. Heat Zone Icon (Heatwave Risk Engine)
const heatZoneIcon = (riskLevel) => {
  const borderColor = riskLevel === 'CRITICAL' ? 'border-red-500' :
                      riskLevel === 'HIGH' ? 'border-orange-500' : 'border-yellow-500';
  const shadowColor = riskLevel === 'CRITICAL' ? 'shadow-red-500/50' :
                      riskLevel === 'HIGH' ? 'shadow-orange-500/50' : 'shadow-yellow-500/50';
  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="relative w-8 h-8 rounded-full border-2 bg-slate-900/90 ${borderColor} flex items-center justify-center shadow-[0_0_8px_rgba(0,0,0,0.5)] ${shadowColor} transform hover:scale-110 transition-transform">
             <span class="text-white text-[13px]">🌡️</span>
             <span class="absolute -bottom-1 -right-1 text-[11px] animate-pulse">⚠️</span>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// --- 🚨 NAGARSANKAT: GEOFENCE DRAWER COMPONENT ---
function GeofenceDrawer({ active, points, setPoints }) {
  useMapEvents({
    click(e) {
      if (active) {
        setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      }
    },
    contextmenu(e) {
      if (active && points.length > 0) {
        setPoints((prev) => prev.slice(0, -1)); // Right-click removes last point
      }
    }
  });

  if (!active || points.length === 0) return null;

  return (
    <>
      {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3 }} />}
      {points.map((pt, i) => (
        <CircleMarker key={i} center={pt} radius={4} pathOptions={{ color: '#ef4444', fillColor: 'white', fillOpacity: 1 }} />
      ))}
      {points.length > 1 && (
        <Polyline positions={points} pathOptions={{ color: '#ef4444', dashArray: '5, 5' }} />
      )}
    </>
  );
}

function App() {
  const [incidents, setIncidents] = useState([]);
  // --- NEW: Vayu AQI State ---
  const [showAQI, setShowAQI] = useState(false);
  const [aqiData, setAqiData] = useState([]);

  // --- NEW: Routing & Units State ---
  const [units, setUnits] = useState([]);
  const [activeRoutes, setActiveRoutes] = useState({}); // { incidentId: { polyline: [], eta: 0 } }

  // --- NEW: Predictive AI Heatmap State ---
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);

  // --- NEW: Traffic Prediction State ---
  const [showTraffic, setShowTraffic] = useState(false);
  const [trafficData, setTrafficData] = useState([]);

  // --- NEW: City Health (Grievances) State ---
  const [showGrievances, setShowGrievances] = useState(false);
  const [grievances, setGrievances] = useState([]);

  // --- PARIVAHAN: ANPR STATE ---
  const [showParivahan, setShowParivahan] = useState(false);
  const [cctvCameras, setCctvCameras] = useState([]);
  const [violations, setViolations] = useState([]);
  const [showViolationsPanel, setShowViolationsPanel] = useState(false);
  const anprScanIntervalRef = useRef(null);

  // --- 🏥 MEDATA: HOSPITAL ROUTING STATE ---
  const [showMedETA, setShowMedETA] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [medRoute, setMedRoute] = useState(null); // Active MedETA routing result
  const [medRouteLoading, setMedRouteLoading] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);

  // --- 🌊 FLOOD EARLY WARNING STATE ---
  const [showFlood, setShowFlood] = useState(false);
  const [floodSensors, setFloodSensors] = useState([]);
  const [floodSummary, setFloodSummary] = useState(null);
  const floodIntervalRef = useRef(null);

  // --- 🧾 AI CHALLAN DISPUTE STATE ---
  const [showChallan, setShowChallan] = useState(false);
  const [challanFile, setChallanFile] = useState(null);
  const [challanLoading, setChallanLoading] = useState(false);
  const [challanResult, setChallanResult] = useState(null);
  const challanFileRef = useRef(null);

  const handleChallanUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChallanFile(URL.createObjectURL(file));
    setChallanLoading(true);
    setChallanResult(null);

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('citizen_name', 'Rahul Sharma'); // Demo data

    try {
      const res = await axios.post('http://localhost:8000/api/v1/challan/dispute', formData);
      setChallanResult(res.data);
    } catch (err) {
      console.error('[ChallanAI] Error:', err);
      alert('Failed to analyze challan. Make sure backend is running.');
    } finally {
      setChallanLoading(false);
    }
  };

  const downloadChallanPdf = () => {
    if (!challanResult?.pdf_base64) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${challanResult.pdf_base64}`;
    link.download = `NagarIQ_Challan_Dispute_${challanResult.fields?.challan_number || 'draft'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 📷 FACETRACE: MISSING PERSON STATE ---
  const [showFaceTrace, setShowFaceTrace] = useState(false);
  const [faceTraceLoading, setFaceTraceLoading] = useState(false);
  const [faceTraceResult, setFaceTraceResult] = useState(null);
  const [faceTraceSubject, setFaceTraceSubject] = useState('');
  const [faceTracePreview, setFaceTracePreview] = useState(null);
  const faceTraceFileRef = useRef(null);

  // --- 🌐 DIGITAL TWIN STATE ---
  const [showDigitalTwin, setShowDigitalTwin] = useState(false);

  // --- 🌍 NAGARSEVA VOLUNTEERS STATE ---
  const [showVolunteers, setShowVolunteers] = useState(false);
  const [volunteers, setVolunteers] = useState([]);

  // --- 🌡️ HEAT ISLAND RISK ENGINE STATE ---
  const [showHeat, setShowHeat] = useState(false);
  const [heatZones, setHeatZones] = useState([]);
  const [heatAlerts, setHeatAlerts] = useState([]);

  // --- 🎯 NAGARSCORE GAMIFICATION STATE ---
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);

  // --- 🚌 NAGARYATRA SMART TRANSIT STATE ---
  const [showTransit, setShowTransit] = useState(false);
  const [liveBuses, setLiveBuses] = useState([]);
  const [busStops, setBusStops] = useState([]);
  const transitIntervalRef = useRef(null);

  // --- 💧 JAL SHAKTI: WATER MONITORING STATE ---
  const [showJalShakti, setShowJalShakti] = useState(false);
  const [waterZones, setWaterZones] = useState([]);
  const [waterAlerts, setWaterAlerts] = useState([]);
  const [waterSummary, setWaterSummary] = useState(null);
  const [selectedWaterZone, setSelectedWaterZone] = useState(null);
  const [waterPrediction, setWaterPrediction] = useState(null);
  const [waterLoading, setWaterLoading] = useState(false);
  const waterIntervalRef = useRef(null);

  // --- 🚨 NAGARSANKAT GEOFENCE ALERT STATE ---
  const [showGeofence, setShowGeofence] = useState(false);
  const [geofencePoints, setGeofencePoints] = useState([]);
  const [geofenceMessage, setGeofenceMessage] = useState('');
  const [geofenceLoading, setGeofenceLoading] = useState(false);

  // --- VIDYATRACK: SCHOOL MONITORING STATE ---
  const [showVidya, setShowVidya] = useState(false);
  const [vidyaSchools, setVidyaSchools] = useState([]);
  const [vidyaEvents, setVidyaEvents] = useState([]);
  const [showVidyaPanel, setShowVidyaPanel] = useState(false);
  const vidyaIntervalRef = useRef(null);

  const fetchVidyaData = async () => {
    try {
      const [schoolsRes, eventsRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/vidya/schools'),
        axios.get('http://localhost:8000/api/v1/vidya/events'),
      ]);
      if (schoolsRes.data.status === 'success') {
        setVidyaSchools(schoolsRes.data.schools);
      }
      if (eventsRes.data.status === 'success') {
        setVidyaEvents(eventsRes.data.events);
      }
    } catch (e) {
      console.error('[VidyaTrack] Fetch error:', e);
    }
  };

  const toggleVidya = async () => {
    const next = !showVidya;
    setShowVidya(next);
    if (next) {
      await fetchVidyaData();
      vidyaIntervalRef.current = setInterval(fetchVidyaData, 5000);
      setShowVidyaPanel(true);
    } else {
      clearInterval(vidyaIntervalRef.current);
      setVidyaSchools([]);
      setVidyaEvents([]);
      setShowVidyaPanel(false);
    }
  };

  const broadcastGeofenceAlert = async () => {
    if (geofencePoints.length < 3 || !geofenceMessage.trim()) return;
    setGeofenceLoading(true);
    try {
      await axios.post('http://localhost:8000/api/v1/nagarsankat/broadcast', {
        message: geofenceMessage,
        polygon: geofencePoints
      });
      alert('🚨 NagarSankat Alert Broadcasted successfully to citizens in the geofenced area!');
      setGeofenceMessage('');
      setGeofencePoints([]);
      setShowGeofence(false);
    } catch (e) {
      console.error(e);
      alert('Failed to broadcast alert');
    } finally {
      setGeofenceLoading(false);
    }
  };

  const fetchWaterData = async () => {
    try {
      const [zonesRes, alertsRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/water/zones'),
        axios.get('http://localhost:8000/api/v1/water/alerts'),
      ]);
      setWaterZones(zonesRes.data.zones || []);
      setWaterSummary(zonesRes.data.summary || null);
      setWaterAlerts(alertsRes.data.alerts || []);
    } catch (e) { console.error('[JalShakti] Fetch error:', e); }
  };

  const fetchZonePrediction = async (zoneId) => {
    try {
      setWaterLoading(true);
      const res = await axios.get(`http://localhost:8000/api/v1/water/predict/${zoneId}`);
      setWaterPrediction(res.data.prediction || null);
    } catch (e) { console.error('[JalShakti] Predict error:', e); }
    finally { setWaterLoading(false); }
  };

  const toggleJalShakti = () => {
    if (!showJalShakti) {
      fetchWaterData();
      waterIntervalRef.current = setInterval(fetchWaterData, 30000);
    } else {
      clearInterval(waterIntervalRef.current);
      setSelectedWaterZone(null);
      setWaterPrediction(null);
    }
    setShowJalShakti(!showJalShakti);
  };

  // --- NAGRIK-DRISHTI: LIVE FEED STATE ---
  const [activeDrishtiId, setActiveDrishtiId] = useState(null);
  const [drishtiFrame, setDrishtiFrame] = useState(null);
  const [isDrishtiConnected, setIsDrishtiConnected] = useState(false);
  const drishtiWsRef = useRef(null);

  // --- ARIA AI CO-PILOT STATE ---
  const [showAria, setShowAria] = useState(false);
  const [ariaMessages, setAriaMessages] = useState([
    { role: 'aria', text: "👋 I'm **ARIA**, your AI Co-Pilot. Ask me anything about the city situation — *'Show active incidents'*, *'Find nearest idle unit'*, *'City stats'*, or *'Suggest dispatch'*.", tool: 'greet', time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }
  ]);
  const [ariaInput, setAriaInput] = useState('');
  const [ariaLoading, setAriaLoading] = useState(false);
  const ariaBottomRef = useRef(null);

  const toggleAQI = async () => {
    if (!showAQI) {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/v1/environment/aqi');
        if (res.data.status === 'success') {
          setAqiData(res.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch AQI data", error);
      }
    }
    setShowAQI(!showAQI);
  };

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return '#22c55e'; // Green (Good)
    if (aqi <= 100) return '#eab308'; // Yellow (Satisfactory)
    if (aqi <= 200) return '#f97316'; // Orange (Moderate)
    if (aqi <= 300) return '#ef4444'; // Red (Poor/Severe)
    return '#a855f7'; // Purple (Hazardous)
  };

  const updateStatus = async (incidentId, newStatus, unit = null) => {
    try {
      const payload = { status: newStatus };
      if (unit) payload.assigned_unit = unit;

      await axios.patch(`http://127.0.0.1:8000/api/v1/incidents/${incidentId}/status`, payload);
      fetchIncidents(); // Refresh feed
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/v1/routing/units');
      if (res.data.status === 'success') {
        setUnits(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching units", error);
    }
  };

  const fetchVolunteers = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/v1/volunteers');
      if (res.data.status === 'success') {
        setVolunteers(res.data.volunteers);
      }
    } catch (error) {
      console.error("Error fetching volunteers", error);
    }
  };

  const fetchHeatData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/v1/heat/zones');
      if (res.data.status === 'success') {
        setHeatZones(res.data.zones);
        setHeatAlerts(res.data.alerts);
      }
    } catch (error) {
      console.error("Error fetching heat data", error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/v1/nagarscore/leaderboard');
      if (res.data.status === 'success') {
        setLeaderboardData(res.data.leaderboard);
      }
    } catch (error) {
      console.error("Error fetching NagarScore leaderboard", error);
    }
  };

  const handleDispatch = async (incident) => {
    const unitId = prompt(`Select Unit (Available: ${units.map(u => u.id).join(', ')}):`);
    const selectedUnit = units.find(u => u.id === unitId);
    
    if (selectedUnit) {
      // 1. Update status in database
      updateStatus(incident.id, 'dispatched', selectedUnit.id);
      
      // Update unit status to en_route
      axios.patch(`http://127.0.0.1:8000/api/v1/routing/units/${selectedUnit.id}`, { status: 'en_route' }).catch(e => console.error(e));

      // 2. Fetch the "Adaptive Route" (Fastest Path)
      try {
        const routeRes = await axios.get('http://127.0.0.1:8000/api/v1/routing/path', {
          params: {
            start_lat: selectedUnit.lat,
            start_lng: selectedUnit.lng,
            end_lat: incident.lat,
            end_lng: incident.lng
          }
        });

        if (routeRes.data.status === 'success') {
          setActiveRoutes(prev => ({
            ...prev,
            [incident.id]: {
              polyline: routeRes.data.polyline,
              eta: routeRes.data.eta_minutes,
              unitName: selectedUnit.name,
              unitId: selectedUnit.id
            }
          }));
        }
      } catch (error) {
        console.error("Routing failed", error);
      }
    }
  };

  // --- REAL-TIME UNIT MOVEMENT SIMULATION ---
  useEffect(() => {
    const moveInterval = setInterval(() => {
      setActiveRoutes(prevRoutes => {
        const newRoutes = { ...prevRoutes };
        let anyMoved = false;

        Object.keys(newRoutes).forEach(incidentId => {
          const route = newRoutes[incidentId];
          if (route.polyline && route.polyline.length > 0) {
            // Take the next point on the path
            const nextPoint = route.polyline[0];
            
            // Advance the polyline
            const remainingPath = route.polyline.slice(1);
            newRoutes[incidentId] = {
              ...route,
              polyline: remainingPath
            };
            anyMoved = true;

            // Update the unit's position in the backend so it reflects in the UI
            if (route.unitId) {
              const updatePayload = {
                lat: nextPoint[0],
                lng: nextPoint[1]
              };
              
              // If this is the last point, mark unit as arrived/idle and resolve incident
              if (remainingPath.length === 0) {
                updatePayload.status = 'idle';
                updateStatus(incidentId, 'resolved', route.unitId);
              }

              axios.patch(`http://127.0.0.1:8000/api/v1/routing/units/${route.unitId}`, updatePayload)
                .catch(e => console.error("Unit move failed", e));
            }
          }
        });

        return anyMoved ? newRoutes : prevRoutes;
      });
    }, 1000); // Step forward every second

    return () => clearInterval(moveInterval);
  }, []);
  // Fetch Incidents from your FastAPI Backend
  const toggleTraffic = async () => {
    setShowTraffic(!showTraffic);
    if (!showTraffic) {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/traffic/predict');
        setTrafficData(res.data.forecast);
      } catch (e) { console.log("Traffic fetch failed", e); }
    }
  };

  const toggleHeatmap = async () => {
    setShowHeatmap(!showHeatmap);
    if (!showHeatmap) {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/analytics/hotspots');
        if (res.data.status === 'success') {
          setHeatmapData(res.data.predictions);
        }
      } catch (e) { console.log("Heatmap fetch failed", e); }
    }
  };

  const toggleCityHealth = async () => {
    setShowGrievances(!showGrievances);
    if (!showGrievances) {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/grievances');
        if (res.data.status === 'success') {
            setGrievances(res.data.grievances);
        }
      } catch (e) { console.log("Grievance fetch failed", e); }
    }
  };

  const toggleMedETA = async () => {
    const next = !showMedETA;
    setShowMedETA(next);
    if (next) {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/medata/hospitals');
        if (res.data.status === 'success') setHospitals(res.data.hospitals);
      } catch (e) { console.log('MedETA fetch failed', e); }
    } else {
      setMedRoute(null);
      setSelectedHospital(null);
    }
  };

  const triggerMedRoute = async (incident) => {
    setMedRouteLoading(true);
    setMedRoute(null);
    try {
      const res = await axios.post('http://localhost:8000/api/v1/medata/route', {
        incident_lat: incident.lat,
        incident_lng: incident.lng,
        ambulance_id: units.find(u => u.status === 'idle')?.id || 'Amb-01',
        patient_condition: incident.incident_type?.toLowerCase().includes('cardiac') ? 'cardiac' :
                           incident.incident_type?.toLowerCase().includes('fire') ? 'burns' : 'general',
      });
      setMedRoute({ ...res.data, incidentId: incident.id });
    } catch (e) { console.log('MedETA route failed', e); }
    finally { setMedRouteLoading(false); }
  };

  const fetchFloodSensors = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/v1/flood/sensors');
      if (res.data.status === 'success') {
        setFloodSensors(res.data.sensors);
        setFloodSummary(res.data.summary);
      }
    } catch (e) { console.log('Flood sensor fetch failed', e); }
  };

  const toggleFlood = async () => {
    const next = !showFlood;
    setShowFlood(next);
    if (next) {
      await fetchFloodSensors();
      floodIntervalRef.current = setInterval(fetchFloodSensors, 22000);
    } else {
      clearInterval(floodIntervalRef.current);
    }
  };

  const fetchTransitData = async () => {
    try {
      const [busRes, stopRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/transit/buses'),
        axios.get('http://localhost:8000/api/v1/transit/stops'),
      ]);
      if (busRes.data.status === 'success') setLiveBuses(busRes.data.buses);
      if (stopRes.data.status === 'success') setBusStops(stopRes.data.stops);
    } catch (e) { console.error('[NagarYatra] Fetch error:', e); }
  };

  const toggleTransit = async () => {
    const next = !showTransit;
    setShowTransit(next);
    if (next) {
      await fetchTransitData();
      transitIntervalRef.current = setInterval(fetchTransitData, 10000);
    } else {
      clearInterval(transitIntervalRef.current);
      setLiveBuses([]);
      setBusStops([]);
    }
  };

  const CAMERAS = ['CAM-01','CAM-02','CAM-03','CAM-04','CAM-05','CAM-06','CAM-07','CAM-08','CAM-09','CAM-10'];

  const toggleParivahan = async () => {
    const next = !showParivahan;
    setShowParivahan(next);
    if (next) {
      // Fetch camera list once
      try {
        const res = await axios.get('http://localhost:8000/api/v1/anpr/cameras');
        if (res.data.status === 'success') setCctvCameras(res.data.cameras);
      } catch (e) { console.log('Camera fetch failed', e); }
      // Fetch existing violations
      try {
        const res2 = await axios.get('http://localhost:8000/api/v1/anpr/violations');
        if (res2.data.status === 'success') setViolations(res2.data.violations);
      } catch (e) {}
      // Auto-scan every 4 seconds — rotate through cameras
      let camIdx = 0;
      anprScanIntervalRef.current = setInterval(async () => {
        const camId = CAMERAS[camIdx % CAMERAS.length];
        camIdx++;
        try {
          const res = await axios.post(`http://localhost:8000/api/v1/anpr/scan/${camId}`);
          if (res.data.status === 'violation') {
            setViolations(prev => [res.data.data, ...prev].slice(0, 40));
          }
        } catch (e) {}
      }, 4000);
      setShowViolationsPanel(true);
    } else {
      clearInterval(anprScanIntervalRef.current);
      setCctvCameras([]);
      setViolations([]);
      setShowViolationsPanel(false);
    }
  };


  const fetchIncidents = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/v1/incidents');
      if (res.data.status === 'success') {
        const incoming = res.data.data;
        setIncidents(incoming);
        
        // Auto-cleanup: remove paths for resolved incidents
        setActiveRoutes(prev => {
          const next = { ...prev };
          let changed = false;
          Object.keys(next).forEach(incId => {
            const inc = incoming.find(i => i.id === incId);
            if (!inc || inc.status === 'resolved') {
              delete next[incId];
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    } catch (error) {
      console.error("Error fetching incidents. Is the backend running?", error);
    }
  };

  // Auto-refresh the data every 3 seconds
  useEffect(() => {
    fetchIncidents();
    fetchUnits();
    fetchVolunteers();
    fetchHeatData();
    fetchLeaderboard();
    const interval = setInterval(() => {
      fetchIncidents();
      fetchUnits();
      fetchVolunteers();
      fetchHeatData();
      fetchLeaderboard();
    }, 3000);
    return () => {
      clearInterval(interval);
      if (vidyaIntervalRef.current) clearInterval(vidyaIntervalRef.current);
    };
  }, []);

  const openDrishti = (incidentId) => {
    if (drishtiWsRef.current) drishtiWsRef.current.close();
    setActiveDrishtiId(incidentId);
    setDrishtiFrame(null);
    setIsDrishtiConnected(false);
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/drishti/${incidentId}/view`);
    drishtiWsRef.current = ws;
    ws.onopen = () => setIsDrishtiConnected(true);
    ws.onmessage = (e) => {
      if (e.data === 'STREAM_ENDED') {
        setIsDrishtiConnected(false);
        setDrishtiFrame(null);
      } else {
        setDrishtiFrame(e.data);
      }
    };
    ws.onclose = () => setIsDrishtiConnected(false);
  };

  const closeDrishti = () => {
    if (drishtiWsRef.current) drishtiWsRef.current.close();
    setActiveDrishtiId(null);
    setDrishtiFrame(null);
    setIsDrishtiConnected(false);
  };

  const sendAriaMessage = async (e) => {
    e?.preventDefault();
    const msg = ariaInput.trim();
    if (!msg || ariaLoading) return;

    const userMsg = { role: 'user', text: msg, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
    setAriaMessages(prev => [...prev, userMsg]);
    setAriaInput('');
    setAriaLoading(true);

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/v1/aria/chat', { message: msg });
      const ariaMsg = {
        role: 'aria',
        text: res.data.response,
        tool: res.data.tool_used,
        time: res.data.timestamp,
      };
      setAriaMessages(prev => [...prev, ariaMsg]);
    } catch (err) {
      setAriaMessages(prev => [...prev, { role: 'aria', text: '⚠️ I lost contact with the intelligence server. Please check the backend connection.', tool: 'error', time: '--:--' }]);
    } finally {
      setAriaLoading(false);
      setTimeout(() => ariaBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0f1d] text-slate-200 font-sans overflow-hidden">

      {/* LEFT SIDEBAR: Incident Feed */}
      <div className="w-[400px] flex flex-col border-r border-[#1e293b]/50 bg-[#0f1526]/90 backdrop-blur-xl z-10 shadow-[8px_0_30px_rgba(0,0,0,0.5)]">
        
        {/* HEADER */}
        <div className="p-6 bg-gradient-to-b from-[#161e33] to-transparent border-b border-[#2d3748]/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-600/10 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
               <ShieldAlert className="text-red-400 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider text-white uppercase drop-shadow-md">NagarIQ<span className="text-[#38bdf8] font-light"> Dispatch</span></h1>
              <div className="flex items-center gap-2 mt-1">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                 </span>
                 <p className="text-emerald-400/80 text-[10px] font-mono tracking-widest uppercase">Live AI Engine Active</p>
              </div>
            </div>
          </div>
          {/* --- NEW: LAYER TOGGLES (Grid Layout) --- */}
          <div className="grid grid-cols-2 gap-2 mt-5">
            <button 
              onClick={toggleAQI}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${showAQI ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'}`}
            >
              🌿 Vayu AQI
            </button>
            <button 
              onClick={toggleHeatmap}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${showHeatmap ? 'bg-orange-500/10 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)]' : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'}`}
            >
              🔥 AI Hotspots
            </button>
            <button 
              onClick={toggleTraffic}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${showTraffic ? 'bg-[#38bdf8]/10 border-[#38bdf8]/50 text-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.15)]' : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'}`}
            >
              🚗 Nagar-Gati
            </button>
            <button 
              onClick={toggleCityHealth}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${showGrievances ? 'bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'}`}
            >
              🏗️ City Health
            </button>
            {/* Parivahan ANPR — full width */}
            <button
              onClick={toggleParivahan}
              className={`col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${showParivahan ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'}`}
            >
              📹 Parivahan ANPR
              {showParivahan && violations.some(v => v.is_stolen) && (
                <span className="ml-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">STOLEN</span>
              )}
            </button>
            {/* MedETA Hospital Layer — full width */}
            <button
              onClick={toggleMedETA}
              className={`col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${
                showMedETA ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'
              }`}
            >
              🏥 MedETA Hospitals
              {showMedETA && hospitals.length > 0 && (
                <span className="ml-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">{hospitals.filter(h=>h.can_receive).length} OPEN</span>
              )}
            </button>
            {/* FloodWatch IoT — full width */}
            <button
              onClick={toggleFlood}
              className={`col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${
                showFlood
                  ? floodSummary?.critical > 0
                    ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-pulse'
                    : 'bg-blue-500/10 border-blue-400/50 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.2)]'
                  : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'
              }`}
            >
              🌊 FloodWatch IoT
              {showFlood && floodSummary && floodSummary.critical > 0 && (
                <span className="ml-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">{floodSummary.critical} CRITICAL</span>
              )}
              {showFlood && floodSummary && floodSummary.critical === 0 && floodSummary.warning > 0 && (
                <span className="ml-1 bg-amber-500 text-black text-[9px] px-1.5 py-0.5 rounded-full font-black">{floodSummary.warning} WARN</span>
              )}
            </button>
            {/* NagarYatra Transit — full width */}
            <button
              onClick={toggleTransit}
              className={`col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${
                showTransit
                  ? 'bg-blue-500/10 border-blue-400/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                  : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'
              }`}
            >
              🚌 NagarYatra Transit
              {showTransit && liveBuses.length > 0 && (
                <span className="ml-1 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">{liveBuses.length} LIVE</span>
              )}
            </button>
            {/* VidyaTrack Govt Schools — full width */}
            <button
              onClick={toggleVidya}
              className={`col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide uppercase transition-all duration-300 border ${
                showVidya
                  ? 'bg-sky-500/10 border-sky-400/50 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                  : 'bg-[#161e33]/50 border-[#2d3748]/50 text-slate-400 hover:bg-[#1e293b]'
              }`}
            >
              🎓 VidyaTrack Schools
              {showVidya && vidyaSchools.length > 0 && (
                <span className="ml-1 bg-sky-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">{vidyaSchools.length} MONITORED</span>
              )}
            </button>
          </div>

        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-gradient-to-b from-transparent to-[#0a0f1d]/50">

          {/* --- PARIVAHAN: VIOLATIONS LIVE FEED --- */}
          {showViolationsPanel && (
            <div className="bg-[#161e33]/60 border border-amber-500/20 rounded-2xl p-4 backdrop-blur-xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-3xl -mr-6 -mt-6" />
              <div className="flex justify-between items-center mb-3 relative z-10">
                <h3 className="text-amber-400 font-bold text-[11px] tracking-[0.15em] uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Parivahan — Live ANPR Feed
                </h3>
                <span className="bg-amber-500/10 text-amber-300 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-amber-500/20">
                  EasyOCR v2
                </span>
              </div>
              {violations.length === 0 ? (
                <p className="text-slate-500 text-[11px] text-center py-4">Scanning cameras...</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {violations.slice(0, 15).map((v, i) => (
                    <div key={v.id || i} className={`rounded-xl p-3 border ${
                      v.is_stolen
                        ? 'bg-red-900/30 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                        : 'bg-[#0a0f1d]/50 border-[#2d3748]/50'
                    }`}>
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center gap-2">
                          {v.is_stolen && (
                            <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse">🚨 STOLEN</span>
                          )}
                          <span className={`text-[10px] font-black font-mono ${
                            v.is_stolen ? 'text-red-300' : 'text-amber-300'
                          }`}>{v.plate_detected}</span>
                        </div>
                        <span className="text-slate-500 text-[9px] font-mono">{v.camera_id}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-bold ${
                          v.violation_type === 'STOLEN VEHICLE ALERT' ? 'text-red-400' :
                          v.violation_type === 'Speeding' ? 'text-orange-400' : 'text-yellow-400'
                        }`}>{v.violation_type}</span>
                        <span className="text-slate-500 text-[9px]">{Math.round((v.confidence || 0) * 100)}% conf.</span>
                      </div>
                      <p className="text-slate-500 text-[9px] mt-1 truncate">{v.camera_name}</p>
                      {v.plate_image && (
                        <img src={v.plate_image} alt="plate" className="mt-2 w-full h-8 object-contain rounded opacity-80" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- 🌊 FLOODWATCH: LIVE SENSOR PANEL --- */}
          {showFlood && floodSensors.length > 0 && (
            <div className="bg-[#0d1829]/80 border border-blue-400/20 rounded-2xl p-4 backdrop-blur-xl shadow-lg mb-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-blue-400 font-bold text-[11px] tracking-[0.15em] uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  FloodWatch — IoT Sensor Network
                </h3>
                <span className="bg-blue-500/10 text-blue-300 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-blue-500/20">
                  {floodSummary?.critical > 0 ? '🚨 FLOOD RISK' : '🟢 MONITORING'}
                </span>
              </div>
              <div className="space-y-2">
                {floodSensors.map(s => {
                  const pct = Math.min(100, (s.current_level_m / (s.danger_level_m * 1.2)) * 100);
                  return (
                    <div key={s.id} className={`rounded-xl p-3 border transition-all ${
                      s.alert_status === 'CRITICAL' ? 'bg-red-900/25 border-red-500/40' :
                      s.alert_status === 'WARNING'  ? 'bg-amber-900/20 border-amber-500/30' :
                      'bg-blue-900/10 border-blue-500/10'
                    }`}>
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[11px] font-bold text-white truncate max-w-[160px]">{s.name}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ml-1 ${
                          s.alert_status === 'CRITICAL' ? 'bg-red-500/30 text-red-300 animate-pulse' :
                          s.alert_status === 'WARNING'  ? 'bg-amber-500/20 text-amber-300' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>{s.alert_status}</span>
                      </div>
                      {/* Water Level Bar */}
                      <div className="h-1.5 bg-[#0a0f1d] rounded-full overflow-hidden mb-2 border border-[#1e293b]">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            s.alert_status === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                            s.alert_status === 'WARNING'  ? 'bg-amber-400' : 'bg-blue-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-slate-400">🌊 <span className={s.alert_status === 'CRITICAL' ? 'text-red-400 font-bold' : 'text-blue-300'}>{s.current_level_m}m</span></span>
                        <span className="text-slate-500">/ {s.danger_level_m}m limit</span>
                        <span className="text-slate-500">🌧️ {s.rainfall_mm_hr}mm/hr</span>
                        <span className={`text-[9px] ${ s.trend.includes('fast') ? 'text-red-400' : s.trend === 'rising' ? 'text-amber-400' : 'text-emerald-400'}`}>{s.trend === 'rising fast' ? '⬆️⬆️' : s.trend === 'rising' ? '⬆️' : s.trend === 'falling' ? '⬇️' : '➡️'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {floodSummary?.critical > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-red-900/30 border border-red-500/40">
                  <p className="text-red-400 text-[11px] font-black tracking-widest uppercase">🚨 P1 Flood Emergency Auto-Created</p>
                  <p className="text-slate-300 text-[10px] mt-1">IoT system has auto-dispatched a P1 incident. Check incident feed above.</p>
                </div>
              )}
            </div>
          )}

          {/* --- 🏥 MEDATA: HOSPITAL BED PANEL --- */}
          {showMedETA && hospitals.length > 0 && (
            <div className="bg-[#161e33]/60 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur-xl shadow-lg mb-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-emerald-400 font-bold text-[11px] tracking-[0.15em] uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  MedETA — Live Bed Availability
                </h3>
                <span className="bg-emerald-500/10 text-emerald-300 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-emerald-500/20">ABDM Mock</span>
              </div>
              <div className="space-y-2">
                {hospitals.map(h => (
                  <div
                    key={h.id}
                    onClick={() => setSelectedHospital(selectedHospital?.id === h.id ? null : h)}
                    className={`rounded-xl p-3 border cursor-pointer transition-all ${
                      h.status === 'AVAILABLE' ? 'bg-emerald-900/20 border-emerald-500/30 hover:border-emerald-400/60' :
                      h.status === 'BUSY' ? 'bg-amber-900/20 border-amber-500/30 hover:border-amber-400/60' :
                      'bg-red-900/20 border-red-500/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[11px] font-bold text-white">{h.short}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        h.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300' :
                        h.status === 'BUSY' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-red-500/20 text-red-300 animate-pulse'
                      }`}>{h.status}</span>
                    </div>
                    <div className="flex gap-3 text-[10px]">
                      <span className="text-slate-400">🚨 Emerg: <span className={h.available_emergency > 3 ? 'text-emerald-400' : h.available_emergency > 0 ? 'text-amber-400' : 'text-red-400'}>{h.available_emergency}</span></span>
                      <span className="text-slate-400">🫀 ICU: <span className={h.available_icu > 0 ? 'text-blue-400' : 'text-red-400'}>{h.available_icu}</span></span>
                      <span className="text-slate-400">📊 {h.occupancy_pct}% full</span>
                    </div>
                    {selectedHospital?.id === h.id && (
                      <div className="mt-2 pt-2 border-t border-[#2d3748]/50">
                        <p className="text-[10px] text-slate-400 mb-1">📞 {h.phone}</p>
                        <p className="text-[10px] text-[#38bdf8]">{h.specialties.join(' · ')}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* MedETA Routing Result */}
              {medRoute && (
                <div className="mt-3 p-3 rounded-xl bg-[#0a0f1d] border border-emerald-500/40">
                  <p className="text-emerald-400 text-[10px] font-black tracking-widest uppercase mb-2">⚡ Smart Route Active</p>
                  <p className="text-white text-[12px] font-bold">{medRoute.recommended_hospital.name}</p>
                  <div className="flex gap-3 mt-1 text-[11px]">
                    <span className="text-slate-400">🕐 ETA: <span className="text-white font-bold">{medRoute.eta_minutes}min</span></span>
                    <span className="text-slate-400">📍 {medRoute.distance_km}km</span>
                    <span className="text-slate-400">🛏 {medRoute.recommended_hospital.available_emergency} beds</span>
                  </div>
                  {medRoute.alternatives?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#2d3748]/40">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Alternatives</p>
                      {medRoute.alternatives.map((alt, i) => (
                        <p key={i} className="text-[10px] text-slate-400">{alt.name} — {alt.eta}min, {alt.beds} beds</p>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setMedRoute(null)} className="mt-2 text-[9px] text-slate-500 hover:text-red-400 transition-colors">✕ Clear route</button>
                </div>
              )}
            </div>
          )}

          {/* --- TRAFFIC PREDICTION MINI-DASHBOARD --- */}
          {showTraffic && (
            <div className="bg-[#161e33]/60 border border-[#38bdf8]/20 rounded-2xl p-5 mb-2 backdrop-blur-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#38bdf8]/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="flex justify-between items-center mb-5 relative z-10">
                  <h3 className="text-[#38bdf8] font-bold text-[11px] tracking-[0.15em] uppercase flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse"></span>
                     Traffic Forecast (+30m)
                  </h3>
                  <span className="bg-[#38bdf8]/10 text-[#38bdf8] text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-[#38bdf8]/20">LSTM v2.1</span>
                </div>
                <div className="space-y-4 relative z-10">
                  {trafficData.map(node => (
                    <div key={node.node_id} className="group">
                        <div className="flex justify-between text-[11px] mb-1.5 font-bold tracking-wide uppercase">
                          <span className="text-slate-300">{node.name}</span>
                          <span className={node.trend === 'increasing' ? 'text-red-400' : 'text-emerald-400'}>
                            {node.predicted_volume}% {node.trend === 'increasing' ? '↑' : '↓'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#0a0f1d] rounded-full overflow-hidden flex border border-[#2d3748]/30">
                          <div 
                            className="bg-[#38bdf8] h-full transition-all duration-1000" 
                            style={{ width: `${node.current_volume}%`, opacity: 0.3 }}
                          />
                          <div 
                            className={`h-full transition-all duration-1000 ${node.predicted_volume > 80 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : node.predicted_volume > 50 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                            style={{ width: `${node.predicted_volume - node.current_volume}%` }}
                          />
                        </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {/* --- VIDYATRACK: SCHOOLS & STUDENTS LIVE PANEL --- */}
          {showVidyaPanel && vidyaSchools.length > 0 && (
            <div className="bg-[#0b1329]/80 border border-sky-400/20 rounded-2xl p-4 backdrop-blur-xl shadow-lg mb-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sky-400 font-bold text-[11px] tracking-[0.15em] uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  VidyaTrack — School Monitoring
                </h3>
                <span className="bg-sky-500/10 text-sky-300 text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-sky-500/20">
                  RFID IoT Feed
                </span>
              </div>
              
              {/* School Cards */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar mb-4">
                {vidyaSchools.map(s => {
                  const pct = s.attendance_rate;
                  return (
                    <div key={s.id} className="rounded-xl p-3 border border-slate-700/50 bg-[#0a0f1d]/60 hover:border-sky-500/30 transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[11px] font-bold text-white truncate max-w-[190px]">{s.name}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          pct >= 85 ? 'bg-emerald-500/20 text-emerald-300' :
                          pct >= 75 ? 'bg-amber-500/20 text-amber-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>{pct}% Present</span>
                      </div>
                      
                      {/* Attendance Bar */}
                      <div className="h-1.5 bg-[#050914] rounded-full overflow-hidden mb-2 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            pct >= 85 ? 'bg-emerald-400' :
                            pct >= 75 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>👥 {s.active_students} / {s.total_enrolled} active</span>
                        <span>Smart Class: {s.smart_classrooms}</span>
                        <span className={s.meal_status === 'SERVED' ? 'text-emerald-400' : 'text-amber-400'}>
                          🍲 {s.meal_status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RFID Live Event Feed */}
              <div className="border-t border-slate-700/50 pt-3">
                <p className="text-sky-300 text-[10px] font-black tracking-widest uppercase mb-2">📡 Live RFID Check-in logs</p>
                {vidyaEvents.length === 0 ? (
                  <p className="text-slate-500 text-[10px] text-center py-2">Waiting for RFID events...</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {vidyaEvents.map(e => (
                      <div key={e.id} className="text-[9px] bg-slate-900/50 border border-slate-800 rounded p-1.5 flex flex-col font-mono text-slate-300">
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span className={e.type === 'CHECK_IN' ? 'text-emerald-400' : e.type === 'CHECK_OUT' ? 'text-rose-400' : 'text-blue-400'}>
                            [{e.type}]
                          </span>
                          <span>{e.timestamp}</span>
                        </div>
                        <span className="truncate">{e.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500 mt-10 border border-dashed border-[#2d3748] rounded-2xl bg-[#161e33]/20">
               <span className="text-4xl mb-3 opacity-30">✨</span>
               <p className="text-xs uppercase tracking-widest font-bold">No active incidents</p>
               <p className="text-[10px] mt-1 opacity-70">The city is secure</p>
            </div>
          ) : (
            incidents.map((incident) => (
              <div 
                key={incident.id} 
                className={`relative bg-[#161e33]/80 p-5 rounded-2xl border ${incident.incident_type === 'Traffic Violation' ? 'border-yellow-500/20 hover:border-yellow-500/50' : 'border-red-500/20 hover:border-red-500/50'} transition-all duration-300 overflow-hidden group`}
              >
                {/* Subtle Background Glow */}
                <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[50px] opacity-20 pointer-events-none transition-opacity group-hover:opacity-40 ${incident.incident_type === 'Traffic Violation' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                  <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 border ${incident.incident_type === 'Traffic Violation'
                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {incident.incident_type}
                  </span>
                  <span className="text-slate-500 text-[10px] font-mono font-bold tracking-widest uppercase border border-[#2d3748] px-2 py-1 rounded bg-[#0a0f1d]/50">
                    {incident.id}
                  </span>
                </div>

                <div className="space-y-2 mt-4 relative z-10">
                  <div className="flex items-start gap-2.5 text-[13px] text-slate-300 font-medium">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <p className="leading-relaxed">{incident.address}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold tracking-wider uppercase ml-[26px]">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(incident.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  
                  {/* --- NEW: RENDER THE RAW MESSAGE --- */}
                  {incident.description && (
                    <div className="mt-4 ml-[26px] bg-[#0a0f1d]/50 p-4 rounded-xl border border-[#2d3748] relative">
                      <div className="absolute -left-2 top-4 w-4 h-[1px] bg-[#2d3748]"></div>
                      <p className="text-[13px] text-slate-300 italic leading-relaxed">"{incident.description}"</p>
                    </div>
                  )}
                  
                  {/* --- NEW: RENDER THE EMERGENCY PHOTO --- */}
                  {incident.image_data && (
                    <div className="mt-4 pt-4 border-t border-[#2d3748]/50">
                      <img
                        src={incident.image_data}
                        alt="Emergency Evidence"
                        className="w-full h-44 object-cover rounded-xl border border-[#2d3748]"
                      />
                    </div>
                  )}

                  {/* --- NEW: STATUS CONTROLS --- */}
                  <div className="mt-5 pt-5 border-t border-[#2d3748]/50 flex flex-col gap-3">
                    {incident.status === 'active' && (
                      <button 
                        onClick={() => handleDispatch(incident)}
                        className="w-full bg-gradient-to-r from-[#38bdf8] to-blue-600 hover:from-blue-500 hover:to-blue-700 text-[#0a0f1d] text-[11px] font-black tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)] uppercase"
                      >
                        <Navigation className="w-4 h-4" />
                        Init Adaptive Dispatch
                      </button>
                    )}
                    {incident.status === 'dispatched' && (
                      <div className="w-full bg-[#0a0f1d]/80 p-4 rounded-xl border border-[#38bdf8]/30 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#38bdf8]"></div>
                        <div className="flex items-center gap-2 text-[#38bdf8] text-[11px] font-black tracking-widest uppercase mb-1.5 ml-1">
                          <Navigation className="w-3.5 h-3.5 animate-pulse" />
                          Unit En Route: {incident.assigned_unit}
                        </div>
                        {activeRoutes[incident.id] && (
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#2d3748]/50 ml-1">
                             <p className="text-[10px] text-slate-400 font-mono tracking-widest">ETA: <span className="text-[#38bdf8] font-bold text-sm">{activeRoutes[incident.id].eta}m</span></p>
                             <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/20 font-black tracking-widest uppercase">Fastest Path</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* --- NAGRIK-DRISHTI: WATCH LIVE BUTTON --- */}
                    {incident.status !== 'resolved' && showMedETA && (
                      <button
                        onClick={() => triggerMedRoute(incident)}
                        disabled={medRouteLoading}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${
                          medRoute?.incidentId === incident.id
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        🏥 {medRoute?.incidentId === incident.id ? `→ ${medRoute.recommended_hospital.short} (${medRoute.eta_minutes}min)` : (medRouteLoading ? 'Routing...' : 'MedETA Route')}
                      </button>
                    )}
                    {incident.status !== 'resolved' && (
                      <button
                        onClick={() => openDrishti(incident.id)}
                        className="w-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/60 text-red-400 text-[10px] font-black tracking-widest py-3 rounded-xl transition-all uppercase flex items-center justify-center gap-2"
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        Nagrik-Drishti Live
                      </button>
                    )}
                    {incident.status !== 'resolved' ? (
                      <button 
                        onClick={() => updateStatus(incident.id, 'resolved')}
                        className="w-full bg-[#1e293b] hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-400 border border-[#2d3748] text-slate-400 text-[10px] font-black tracking-widest py-3 rounded-xl transition-all uppercase flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    ) : (
                      <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-black tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 uppercase">
                        <CheckCircle2 className="w-4 h-4" />
                        Threat Neutralized
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- NAGRIK-DRISHTI LIVE FEED OVERLAY --- */}
      {activeDrishtiId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#0f1526] border border-red-500/30 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(239,68,68,0.2)] w-full max-w-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2d3748] bg-[#161e33]">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDrishtiConnected && drishtiFrame ? 'bg-red-400' : 'bg-slate-500'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isDrishtiConnected && drishtiFrame ? 'bg-red-500' : 'bg-slate-600'}`}></span>
                </div>
                <div>
                  <p className="text-white font-black text-sm tracking-wider uppercase">Nagrik-Drishti</p>
                  <p className="text-slate-400 text-[10px] font-mono">
                    {isDrishtiConnected && drishtiFrame ? '🔴 LIVE STREAM ACTIVE' : isDrishtiConnected ? '⏳ Waiting for citizen to start stream...' : '🔌 Connecting...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-[10px] font-mono border border-[#2d3748] px-2 py-1 rounded">{activeDrishtiId}</span>
                <button onClick={closeDrishti} className="text-slate-400 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1e293b] transition-all">✕</button>
              </div>
            </div>

            {/* Video Frame */}
            <div className="w-full bg-[#0a0f1d] relative" style={{aspectRatio: '16/9'}}>
              {drishtiFrame ? (
                <img src={drishtiFrame} alt="Live Feed" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <span className="text-3xl">📡</span>
                  </div>
                  <p className="text-slate-500 text-sm font-bold tracking-widest uppercase">
                    {isDrishtiConnected ? 'Awaiting stream from citizen device...' : 'Connecting to relay...'}
                  </p>
                  <div className="flex gap-1">
                    {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-red-500/50 rounded-full animate-bounce" style={{animationDelay: `${i*150}ms`}}></div>)}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 flex justify-between items-center border-t border-[#2d3748]">
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">ICCC Nagrik-Drishti Feed • NagarIQ v1.0</p>
              <button onClick={closeDrishti} className="text-[10px] font-black tracking-widest uppercase bg-[#1e293b] border border-[#2d3748] hover:border-red-500/50 text-slate-400 hover:text-red-400 px-4 py-2 rounded-lg transition-all">Close Feed</button>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT SIDE: Open-Source Dark Map */}
      <div className="flex-1 relative z-0">
        <MapContainer
          center={[22.7196, 75.8577]} // Centered on Indore!
          zoom={12}
          className="w-full h-full"
          zoomControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
          touchZoom={true}
        >
          <ZoomControl position="topright" />
          {/* Free Map Tiles from OpenStreetMap with custom dark mode filter */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            className="dark-tiles"
          />
          {/* --- NEW: NAGARSANKAT DRAWING LAYER --- */}
          <GeofenceDrawer active={showGeofence} points={geofencePoints} setPoints={setGeofencePoints} />

          {/* --- NEW: AMBULANCE UNITS LAYER --- */}
          {units.map((unit) => (
            <Marker
              key={unit.id}
              position={[unit.lat, unit.lng]}
              icon={ambulanceIcon}
            >
              <Popup>
                <div className="text-slate-900">
                  <h3 className="font-bold">{unit.name}</h3>
                  <p className="text-xs">ID: {unit.id} | Status: {unit.status}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* --- NEW: NAGARSEVA VOLUNTEERS LAYER --- */}
          {showVolunteers && volunteers.map((vol) => (
            <Marker
              key={vol.id}
              position={[vol.lat, vol.lng]}
              icon={volunteerIcon}
            >
              <Popup>
                <div className="text-slate-900">
                  <h3 className="font-bold text-blue-600">🌍 NagarSeva Responder</h3>
                  <p className="font-bold text-sm mt-1">{vol.name}</p>
                  <p className="text-xs mt-1">ID: {vol.id} | {vol.status}</p>
                  <div className="flex gap-1 mt-2">
                    {vol.skills.map((skill, i) => (
                      <span key={i} className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">{skill}</span>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* --- NEW: ADAPTIVE ROUTE LAYER --- */}
          {Object.entries(activeRoutes).map(([incidentId, route]) => (
            <Polyline
              key={`route-${incidentId}`}
              positions={route.polyline}
              pathOptions={{
                color: '#38bdf8',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10',
                lineJoin: 'round'
              }}
            />
          ))}

          {/* --- NEW: RANDOM FOREST HOTSPOT LAYER (AI Heatmap) --- */}
          {showHeatmap && heatmapData.map((node) => (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={node.weight * 40} /* Dynamic blast radius based on AI probability, reduced for less clutter */
              pathOptions={{
                fillColor: '#ef4444',
                color: 'transparent',
                fillOpacity: 0.2, /* Constant low opacity to prevent messy overlaps */
              }}
            >
              <Tooltip sticky className="bg-slate-900 border-none text-white text-[10px] p-2 rounded shadow-xl">
                <span className="font-bold text-red-400">🔥 High Risk Zone</span><br/>
                AI Probability: {(node.weight * 100).toFixed(1)}%
              </Tooltip>
            </CircleMarker>
          ))}

          {/* --- NEW: TRAFFIC PREDICTION GLOW LAYER --- */}
          {showTraffic && trafficData.map((node) => (
            <CircleMarker
              key={`traffic-${node.node_id}`}
              center={[node.lat, node.lng]}
              radius={node.predicted_volume / 2.5}
              pathOptions={{
                fillColor: node.predicted_volume > 80 ? '#ef4444' : node.predicted_volume > 50 ? '#f97316' : '#10b981',
                color: node.predicted_volume > 80 ? '#ef4444' : 'transparent',
                fillOpacity: 0.3,
                weight: 2,
                dashArray: '5, 5'
              }}
            >
              <Tooltip permanent direction="top" className="bg-slate-900 border-none text-white text-[10px] p-1 rounded">
                {node.name}: {node.predicted_volume}%
              </Tooltip>
            </CircleMarker>
          ))}

          {/* --- VIDYATRACK: GOVERNMENT SCHOOL MARKERS --- */}
          {showVidya && vidyaSchools.map((school) => (
            <Marker
              key={school.id}
              position={[school.lat, school.lng]}
              icon={schoolIcon}
            >
              <Popup className="custom-popup">
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-sky-500/20 text-sky-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Govt School</span>
                    <span className="text-slate-400 text-[9px]">{school.id}</span>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-1">{school.name}</h3>
                  <p className="text-slate-400 text-[11px] mb-2">{school.type}</p>
                  
                  <div className="grid grid-cols-2 gap-1 text-[10px] mb-3">
                    <div className="bg-slate-800 rounded p-1.5 text-center">
                      <p className="font-black text-sm text-sky-400">{school.active_students}</p>
                      <p className="text-slate-500 text-[8px] uppercase">Active Students</p>
                    </div>
                    <div className="bg-slate-800 rounded p-1.5 text-center">
                      <p className="font-black text-sm text-emerald-400">{school.attendance_rate}%</p>
                      <p className="text-slate-500 text-[8px] uppercase">Attendance</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-[10px] text-slate-300">
                    <p>🧑‍🏫 <b>Principal:</b> {school.principal}</p>
                    <p>📞 <b>Phone:</b> {school.contact}</p>
                    <p>🍲 <b>Mid-day Meal:</b> <span className={school.meal_status === 'SERVED' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{school.meal_status}</span> {school.meal_status === 'SERVED' && `(${school.meals_served} served)`}</p>
                    <p>🍱 <b>Today's Menu:</b> {school.meal_menu}</p>
                    <div className="pt-1.5 flex gap-2 border-t border-slate-700/50 mt-1.5 text-[8px] font-mono uppercase">
                      <span className={school.cctv_status === 'ONLINE' ? 'text-emerald-400' : 'text-rose-400'}>CCTV: {school.cctv_status}</span>
                      <span className={school.water_purifier_status === 'FUNCTIONAL' ? 'text-emerald-400' : 'text-amber-400'}>Water: {school.water_purifier_status}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* --- PARIVAHAN: CCTV CAMERA MARKERS --- */}
          {showParivahan && cctvCameras.map((cam) => {
            const recentViolation = violations.find(v => v.camera_id === cam.id);
            return (
              <Marker
                key={cam.id}
                position={[cam.lat, cam.lng]}
                icon={recentViolation?.is_stolen ? cctvAlertIcon : cctvIcon}
              >
                <Popup className="custom-popup">
                  <div className="p-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Parivahan</span>
                      <span className="text-slate-400 text-[10px]">{cam.id}</span>
                    </div>
                    <h3 className="text-white font-bold text-sm mb-1">{cam.name}</h3>
                    <p className="text-slate-400 text-xs mb-2">Zone: {cam.zone}</p>
                    {recentViolation ? (
                      <div className={`p-2 rounded-lg text-xs border ${
                        recentViolation.is_stolen
                          ? 'bg-red-900/30 border-red-500/30 text-red-300'
                          : 'bg-amber-900/20 border-amber-500/20 text-amber-300'
                      }`}>
                        <p className="font-black">{recentViolation.is_stolen ? '🚨 STOLEN VEHICLE' : recentViolation.violation_type}</p>
                        <p className="font-mono mt-0.5">{recentViolation.plate_detected}</p>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[10px]">No recent violations</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* --- CITY HEALTH (GRIEVANCES) LAYER --- */}
          {showGrievances && grievances.map((g) => (
             <Marker key={`g-${g.id}`} position={[g.lat, g.lng]} icon={grievanceIcon}>
                <Popup className="custom-popup">
                    <div className="p-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-purple-600/20 text-purple-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Indore-311</span>
                            <span className="text-slate-400 text-[10px]">{g.id}</span>
                        </div>
                        <h3 className="text-white font-bold text-sm mb-1">{g.category}</h3>
                        <p className="text-slate-400 text-xs mb-3">{g.description}</p>
                        <div className="flex items-center gap-2 text-xs">
                            <span className={`font-bold ${g.priority >= 4 ? 'text-red-400' : 'text-emerald-400'}`}>Priority: Level {g.priority}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-300 capitalize">{g.status}</span>
                        </div>
                    </div>
                </Popup>
             </Marker>
          ))}

          {/* --- 🏥 MEDATA: HOSPITAL MAP MARKERS --- */}
          {showMedETA && hospitals.map(h => (
            <Marker
              key={h.id}
              position={[h.lat, h.lng]}
              icon={hospitalIcon(h.status)}
            >
              <Popup className="custom-popup">
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      h.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400' :
                      h.status === 'BUSY' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                    }`}>{h.status}</span>
                    <span className="text-slate-400 text-[10px]">{h.type}</span>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-2">{h.name}</h3>
                  <div className="grid grid-cols-2 gap-1 text-[11px] mb-2">
                    <div className="bg-slate-800 rounded p-1.5 text-center">
                      <p className={`font-black text-lg ${h.available_emergency > 3 ? 'text-emerald-400' : h.available_emergency > 0 ? 'text-amber-400' : 'text-red-400'}`}>{h.available_emergency}</p>
                      <p className="text-slate-500 text-[9px] uppercase">Emerg Beds</p>
                    </div>
                    <div className="bg-slate-800 rounded p-1.5 text-center">
                      <p className={`font-black text-lg ${h.available_icu > 0 ? 'text-blue-400' : 'text-red-400'}`}>{h.available_icu}</p>
                      <p className="text-slate-500 text-[9px] uppercase">ICU Beds</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[10px]">📞 {h.phone}</p>
                  <p className="text-[#38bdf8] text-[10px] mt-1">{h.specialties?.join(' · ')}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* --- 🏥 MEDATA: SMART ROUTE POLYLINE (ambulance → hospital) --- */}
          {showMedETA && medRoute?.polyline && (
            <Polyline
              positions={medRoute.polyline}
              pathOptions={{
                color: '#10b981',
                weight: 5,
                opacity: 0.9,
                dashArray: '8, 6',
              }}
            />
          )}

          {/* --- 🌊 FLOODWATCH: SENSOR MAP MARKERS --- */}
          {showFlood && floodSensors.map(s => (
            <CircleMarker
              key={`flood-${s.id}`}
              center={[s.lat, s.lng]}
              radius={s.alert_status === 'CRITICAL' ? 28 : s.alert_status === 'WARNING' ? 20 : 14}
              pathOptions={{
                fillColor: s.alert_status === 'CRITICAL' ? '#ef4444' : s.alert_status === 'WARNING' ? '#f59e0b' : '#60a5fa',
                color: s.alert_status === 'CRITICAL' ? '#ef4444' : s.alert_status === 'WARNING' ? '#f59e0b' : '#60a5fa',
                fillOpacity: s.alert_status === 'CRITICAL' ? 0.35 : 0.2,
                weight: 2,
              }}
            >
              <Tooltip permanent direction="top" className="bg-slate-900 border-none text-white text-[10px] p-1.5 rounded shadow-xl">
                <span className={`font-black ${s.alert_status === 'CRITICAL' ? 'text-red-400' : s.alert_status === 'WARNING' ? 'text-amber-400' : 'text-blue-400'}`}>
                  🌊 {s.id}
                </span>
                <br />{s.current_level_m}m / {s.danger_level_m}m
              </Tooltip>
              <Popup className="custom-popup">
                <div className="p-1 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      s.alert_status === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                      s.alert_status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>{s.alert_status}</span>
                    <span className="text-slate-400 text-[9px]">{s.id}</span>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-2">{s.name}</h3>
                  <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                    <div className="bg-slate-800 rounded p-1 text-center">
                      <p className={`font-black text-base ${s.alert_status === 'CRITICAL' ? 'text-red-400' : 'text-blue-400'}`}>{s.current_level_m}m</p>
                      <p className="text-slate-500 text-[8px] uppercase">Current</p>
                    </div>
                    <div className="bg-slate-800 rounded p-1 text-center">
                      <p className="font-black text-base text-slate-300">{s.danger_level_m}m</p>
                      <p className="text-slate-500 text-[8px] uppercase">Danger Limit</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[10px]">🌧️ Rainfall: {s.rainfall_mm_hr}mm/hr</p>
                  <p className="text-slate-400 text-[10px]">📈 Trend: {s.trend}</p>
                  <p className="text-slate-500 text-[9px] mt-1">River: {s.river}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* --- NEW: HEAT ISLAND LAYER --- */}
          {showHeat && (
            <HeatmapLayer
              points={heatZones.map((z) => [
                z.lat,
                z.lng,
                z.perceived_temp_c / 85.0 // Normalize weight based on max expected perceived temp
              ])}
            />
          )}
          {showHeat && heatZones.map((zone) => (
            <Marker
              key={zone.id}
              position={[zone.lat, zone.lng]}
              icon={heatZoneIcon(zone.risk_level)}
            >
              <Tooltip direction="top" className="bg-slate-900 border border-slate-700 text-white text-[10px] p-2 rounded shadow-xl">
                <span className="font-bold">{zone.name}</span><br />
                <span className={`font-black ${zone.risk_level === 'CRITICAL' ? 'text-red-400' : zone.risk_level === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'}`}>
                  🌡️ {zone.perceived_temp_c}°C ({zone.risk_level} RISK)
                </span>
              </Tooltip>
              <Popup className="custom-popup">
                <div className="p-1 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      zone.risk_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                      zone.risk_level === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{zone.risk_level} RISK</span>
                    <span className="text-slate-400 text-[9px]">{zone.id}</span>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-2">{zone.name}</h3>
                  <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                    <div className="bg-slate-800 rounded p-1 text-center">
                      <p className={`font-black text-base ${zone.risk_level === 'CRITICAL' ? 'text-red-400' : 'text-orange-400'}`}>{zone.perceived_temp_c}°C</p>
                      <p className="text-slate-500 text-[8px] uppercase">Heat Index</p>
                    </div>
                    <div className="bg-slate-800 rounded p-1 text-center">
                      <p className="font-black text-base text-slate-300">{zone.current_temp_c}°C</p>
                      <p className="text-slate-500 text-[8px] uppercase">Actual Temp</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[10px]">💧 Humidity: {zone.humidity_pct}%</p>
                  <p className="text-slate-400 text-[10px]">🏙️ Type: {zone.type.replace('_', ' ')}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* --- 🚌 NAGARYATRA: BUS STOPS LAYER --- */}
          {showTransit && busStops.map((stop) => (
            <CircleMarker
              key={stop.id}
              center={[stop.lat, stop.lng]}
              radius={5}
              pathOptions={{ fillColor: stop.route_color, color: '#fff', fillOpacity: 0.9, weight: 1.5 }}
            >
              <Tooltip sticky className="bg-slate-900 border-none text-white text-[10px] p-2 rounded shadow-xl">
                <span className="font-bold" style={{color: stop.route_color}}>🚏 {stop.name}</span><br/>
                <span className="text-slate-400">{stop.route_name}</span>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* --- 🚌 NAGARYATRA: LIVE BUS MARKERS --- */}
          {showTransit && liveBuses.map((bus) => {
            const busIcon = L.divIcon({
              html: `<div style="background:${bus.route_color};width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 12px ${bus.route_color}88;border:2px solid white;">🚌</div>`,
              className: '',
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });
            return (
              <Marker key={bus.id} position={[bus.lat, bus.lng]} icon={busIcon}>
                <Tooltip sticky className="bg-slate-900 border-none text-white text-[10px] p-2 rounded shadow-xl">
                  <span className="font-bold text-blue-300">{bus.id}</span><br/>
                  🗺️ {bus.route_name}<br/>
                  🚏 Next: <b>{bus.next_stop_name}</b> in ~{bus.eta_minutes} min<br/>
                  👥 Occupancy: {bus.occupancy}/{bus.capacity} ({bus.occupancy_pct}%)<br/>
                  🚀 Speed: {bus.speed_kmh} km/h
                </Tooltip>
                <Popup className="custom-popup">
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-400">LIVE</span>
                      <span className="text-slate-400 text-[9px]">{bus.id}</span>
                    </div>
                    <h3 className="text-white font-bold text-sm mb-2">{bus.route_name}</h3>
                    <p className="text-slate-300 text-[11px]">🚏 Next Stop: <b>{bus.next_stop_name}</b></p>
                    <p className="text-slate-300 text-[11px]">⏱️ ETA: ~{bus.eta_minutes} minute(s)</p>
                    <div className="mt-2 bg-slate-800 rounded p-2">
                      <p className="text-slate-400 text-[10px] mb-1">Occupancy</p>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{width: `${bus.occupancy_pct}%`, backgroundColor: bus.occupancy_pct > 80 ? '#ef4444' : bus.occupancy_pct > 50 ? '#f97316' : '#10b981'}}/>
                      </div>
                      <p className="text-slate-500 text-[9px] mt-1">{bus.occupancy}/{bus.capacity} passengers</p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Draw Markers for every incident */}
          {incidents.map((incident) => (
            <Marker
              key={incident.id}
              position={[incident.lat, incident.lng]}
              icon={incident.incident_type === 'Traffic Violation' ? pulsingYellowIcon : pulsingRedIcon}
            >
              <Popup className="custom-popup">
                <div className="text-slate-900">
                  <h3 className="font-bold text-lg m-0">{incident.incident_type}</h3>
                  <p className="text-sm m-0 mt-1">{incident.address}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ─── ARIA FLOATING CHAT BUTTON ─── */}
      <button
        onClick={() => setShowAria(!showAria)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${
          showAria ? 'bg-[#38bdf8] rotate-45 scale-90' : 'bg-gradient-to-br from-[#38bdf8] to-[#6366f1] hover:scale-110'
        }`}
        title="ARIA AI Co-Pilot"
      >
        <span className="text-2xl">{showAria ? '✕' : '🤖'}</span>
      </button>

      {/* ─── NAGARSEVA FLOATING BUTTON ─── */}
      <button
        onClick={() => setShowVolunteers(!showVolunteers)}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all duration-300 hover:scale-110 ${
          showVolunteers ? 'bg-gradient-to-br from-blue-400 to-indigo-600 shadow-[0_0_40px_rgba(59,130,246,0.8)]' : 'bg-gradient-to-br from-slate-700 to-slate-800 opacity-60 hover:opacity-100'
        }`}
        title="Toggle NagarSeva Volunteers"
      >
        <span className="text-2xl">🌍</span>
        {showVolunteers && volunteers.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full text-[9px] text-white font-black flex items-center justify-center border-2 border-[#060d1f]">{volunteers.length}</span>
        )}
      </button>

      {/* ─── HEAT ISLAND FLOATING BUTTON ─── */}
      <button
        onClick={() => setShowHeat(!showHeat)}
        className={`fixed bottom-24 left-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all duration-300 hover:scale-110 ${
          showHeat ? 'bg-gradient-to-br from-orange-400 to-red-600 shadow-[0_0_40px_rgba(239,68,68,0.8)]' : 'bg-gradient-to-br from-slate-700 to-slate-800 opacity-60 hover:opacity-100'
        }`}
        title="Toggle Heat Island Risk Engine"
      >
        <span className="text-2xl">🌡️</span>
        {showHeat && heatAlerts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] text-white font-black flex items-center justify-center border-2 border-[#060d1f] animate-pulse">{heatAlerts.length}</span>
        )}
      </button>

      {/* ─── NAGARSCORE LEADERBOARD FLOATING BUTTON ─── */}
      <button
        onClick={() => setShowLeaderboard(!showLeaderboard)}
        className={`fixed bottom-[168px] left-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all duration-300 hover:scale-110 ${
          showLeaderboard ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-[0_0_40px_rgba(234,179,8,0.8)] scale-110' : 'bg-gradient-to-br from-slate-700 to-slate-800 opacity-60 hover:opacity-100'
        }`}
        title="NagarScore Gamification Leaderboard"
      >
        <span className="text-2xl">🏆</span>
      </button>

      {/* ─── NAGARSANKAT GEOFENCE BUTTON ─── */}
      <button
        onClick={() => {
          setShowGeofence(!showGeofence);
          if (showGeofence) {
            setGeofencePoints([]);
            setGeofenceMessage('');
          }
        }}
        className={`fixed bottom-[240px] left-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all duration-300 hover:scale-110 ${
          showGeofence ? 'bg-gradient-to-br from-red-500 to-rose-700 shadow-[0_0_40px_rgba(225,29,72,0.8)] scale-110 animate-pulse' : 'bg-gradient-to-br from-slate-700 to-slate-800 opacity-60 hover:opacity-100'
        }`}
        title="NagarSankat - Geofenced Broadcast"
      >
        <span className="text-2xl">🚨</span>
      </button>

      {/* ─── NAGARSANKAT GEOFENCE UI PANEL ─── */}
      {showGeofence && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#0f172a]/90 backdrop-blur-md border-2 border-red-500/50 rounded-2xl p-4 w-[400px] z-50 shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-in fade-in slide-in-from-top-10">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-red-400 font-bold tracking-widest uppercase flex items-center gap-2">
              <span className="animate-pulse">🚨</span> NagarSankat Broadcast
            </h3>
            <button onClick={() => setShowGeofence(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          
          <div className="text-xs text-slate-300 mb-4 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
            <p className="mb-1"><strong>1.</strong> Click on the map to draw a custom polygon.</p>
            <p className="mb-1"><strong>2.</strong> Right-click to undo the last point.</p>
            <p><strong>3.</strong> Enter message and broadcast.</p>
          </div>

          <div className="mb-4">
            <span className="text-xs text-slate-400 font-mono">Status: </span>
            <span className={`text-xs font-bold ${geofencePoints.length < 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {geofencePoints.length < 3 ? `Need ${3 - geofencePoints.length} more points` : 'Zone Defined Ready'}
            </span>
          </div>

          <textarea
            value={geofenceMessage}
            onChange={(e) => setGeofenceMessage(e.target.value)}
            placeholder="URGENT: Evacuate area immediately due to..."
            className="w-full h-24 bg-[#1e293b] border border-red-500/30 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-red-500 mb-3"
          />

          <button
            onClick={broadcastGeofenceAlert}
            disabled={geofencePoints.length < 3 || !geofenceMessage.trim() || geofenceLoading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white font-bold py-3 rounded-xl uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {geofenceLoading ? 'Broadcasting...' : 'Broadcast to Zone'}
          </button>
        </div>
      )}

      {/* ─── NAGARSCORE LEADERBOARD PANEL ─── */}
      <div className={`fixed top-0 left-0 h-screen w-[400px] bg-[#0a0f1d]/95 backdrop-blur-2xl border-r border-yellow-500/20 z-[60] transform transition-transform duration-500 ease-in-out shadow-[20px_0_60px_rgba(234,179,8,0.1)] flex flex-col ${showLeaderboard ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-[#161e33] to-[#0f1526] border-b border-yellow-500/20 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex justify-between items-center mb-2 relative z-10">
            <h2 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-3">
              <span className="text-2xl">🏆</span> NagarScore
            </h2>
            <button onClick={() => setShowLeaderboard(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer relative z-20">✕</button>
          </div>
          <p className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-4 relative z-10">Top Citizens of Indore</p>
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl backdrop-blur-md">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl font-black text-white shadow-[0_0_15px_rgba(234,179,8,0.5)]">1</div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Current Leader</p>
              <p className="text-white font-bold">{leaderboardData[0]?.name || "Loading..."}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-yellow-400 font-black">{leaderboardData[0]?.score || 0} XP</p>
            </div>
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {leaderboardData.map((citizen, index) => (
            <div key={citizen.id} className="bg-[#161e33]/50 border border-[#2d3748]/50 rounded-xl p-4 relative overflow-hidden hover:border-yellow-500/30 transition-colors group">
              {/* Rank Badge */}
              <div className={`absolute top-0 right-0 w-12 h-12 flex items-center justify-center -mr-2 -mt-2 transform rotate-12 opacity-20 font-black text-5xl ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-700'}`}>
                #{index + 1}
              </div>
              
              <div className="flex items-start gap-4 relative z-10">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-2xl shadow-inner shrink-0">
                  {citizen.avatar}
                </div>
                
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-white text-sm truncate">{citizen.name}</h3>
                    <span className="text-yellow-400 font-black text-sm shrink-0">{citizen.score} XP</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                      citizen.tier === 'Platinum' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                      citizen.tier === 'Gold' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                      citizen.tier === 'Silver' ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                      'bg-orange-800/30 text-orange-400 border border-orange-800/50'
                    }`}>
                      {citizen.tier} Tier
                    </span>
                    <span className="text-slate-500 text-[10px] font-mono">{citizen.id}</span>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {citizen.badges.map((badge, i) => (
                      <span key={i} className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                        {badge.includes('Hero') || badge.includes('Guardian') ? '🎖️' : '🌟'} {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── ARIA CHAT PANEL ─── */}
      {showAria && (
        <div className="fixed bottom-24 right-[90px] z-[100] w-[400px] max-h-[580px] flex flex-col rounded-3xl border border-[#38bdf8]/30 bg-[#0a0f1d]/95 backdrop-blur-2xl shadow-[0_0_60px_rgba(56,189,248,0.15)] overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-[#161e33] to-[#0f1526] border-b border-[#2d3748]/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#38bdf8]/20 to-[#6366f1]/20 border border-[#38bdf8]/30 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div className="flex-1">
              <p className="text-white font-black text-sm tracking-wider">ARIA</p>
              <p className="text-[#38bdf8] text-[10px] font-mono tracking-widest uppercase">AI Co-Pilot • LangChain Engine</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 text-[10px] font-bold tracking-widest uppercase">Live</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0" style={{maxHeight: '420px'}}>
            {ariaMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${ msg.role === 'user' ? 'flex-row-reverse' : 'flex-row' }`}>
                {msg.role === 'aria' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#38bdf8]/20 to-[#6366f1]/20 border border-[#38bdf8]/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs">🤖</span>
                  </div>
                )}
                <div className={`max-w-[82%] ${ msg.role === 'user' ? 'items-end' : 'items-start' } flex flex-col gap-1`}>
                  {msg.tool && msg.tool !== 'greet' && (
                    <span className="text-[9px] font-black tracking-widest uppercase text-[#38bdf8]/60 px-2">
                      ⚡ {msg.tool.replace(/_/g, ' ')}
                    </span>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#38bdf8] text-[#0a0f1d] font-bold rounded-tr-sm'
                      : 'bg-[#161e33] border border-[#2d3748]/60 text-slate-200 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono px-1">{msg.time}</span>
                </div>
              </div>
            ))}
            {ariaLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#38bdf8]/20 to-[#6366f1]/20 border border-[#38bdf8]/20 flex items-center justify-center">
                  <span className="text-xs">🤖</span>
                </div>
                <div className="bg-[#161e33] border border-[#2d3748]/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full animate-bounce" style={{animationDelay: `${i*150}ms`}} />)}
                </div>
              </div>
            )}
            <div ref={ariaBottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-[#1e293b]/50">
            {['Find idle unit', 'Active incidents', 'City stats', 'Crime hotspots'].map(prompt => (
              <button
                key={prompt}
                onClick={() => { setAriaInput(prompt); }}
                className="text-[10px] font-bold tracking-wide text-[#38bdf8] bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 border border-[#38bdf8]/20 px-2.5 py-1 rounded-lg transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={sendAriaMessage} className="flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              value={ariaInput}
              onChange={e => setAriaInput(e.target.value)}
              placeholder="Ask ARIA anything..."
              disabled={ariaLoading}
              className="flex-1 bg-[#161e33] border border-[#2d3748] hover:border-[#38bdf8]/40 focus:border-[#38bdf8] text-white text-[12px] placeholder-slate-600 px-3.5 py-2.5 rounded-xl outline-none transition-all font-mono"
            />
            <button
              type="submit"
              disabled={ariaLoading || !ariaInput.trim()}
              className="w-10 h-10 bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:bg-[#1e293b] disabled:text-slate-600 text-[#0a0f1d] rounded-xl flex items-center justify-center transition-all font-black text-sm flex-shrink-0"
            >
              {ariaLoading ? '⏳' : '↑'}
            </button>
          </form>
        </div>
      )}

      {/* ─── FACETRACE FLOATING BUTTON (above ARIA) ─── */}
      <button
        onClick={() => setShowFaceTrace(!showFaceTrace)}
        className={`fixed bottom-24 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 ${
          showFaceTrace ? 'bg-purple-500 rotate-12 scale-90' : 'bg-gradient-to-br from-purple-500 to-pink-600 hover:scale-110'
        }`}
        title="FaceTrace — Missing Person Search"
      >
        <span className="text-2xl">📷</span>
      </button>

      {/* ─── FACETRACE MODAL ─── */}
      {showFaceTrace && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowFaceTrace(false)}>
          <div className="bg-[#0a0f1d] border border-purple-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_80px_rgba(168,85,247,0.2)]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#161e33] to-[#0f1526] border-b border-purple-500/20 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                  <span className="text-xl">📷</span>
                </div>
                <div>
                  <h2 className="text-white font-black text-lg tracking-wider">FaceTrace</h2>
                  <p className="text-purple-400 text-[10px] font-mono tracking-widest uppercase">Missing Person Search • DeepFace AI</p>
                </div>
              </div>
              <button onClick={() => setShowFaceTrace(false)} className="w-8 h-8 rounded-lg bg-[#1e293b] hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all font-bold">✕</button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* LEFT: Upload panel */}
              <div className="w-64 flex-shrink-0 border-r border-[#1e293b] p-5 flex flex-col gap-4">
                {/* Photo upload dropzone */}
                <div
                  onClick={() => faceTraceFileRef.current?.click()}
                  className="relative cursor-pointer rounded-2xl border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 bg-purple-900/10 hover:bg-purple-900/20 transition-all flex flex-col items-center justify-center p-4 aspect-square"
                >
                  {faceTracePreview ? (
                    <img src={faceTracePreview} className="w-full h-full object-cover rounded-xl" alt="Preview" />
                  ) : (
                    <div className="text-center">
                      <span className="text-4xl block mb-2 opacity-50">📸</span>
                      <p className="text-purple-400 text-[11px] font-bold">Click to Upload</p>
                      <p className="text-slate-600 text-[9px] mt-1">JPEG / PNG / WEBP</p>
                    </div>
                  )}
                </div>
                <input
                  ref={faceTraceFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files[0];
                    if (f) setFaceTracePreview(URL.createObjectURL(f));
                  }}
                />

                <input
                  type="text"
                  value={faceTraceSubject}
                  onChange={e => setFaceTraceSubject(e.target.value)}
                  placeholder="Subject name (optional)"
                  className="bg-[#161e33] border border-[#2d3748] focus:border-purple-500 text-white text-[12px] placeholder-slate-600 px-3 py-2.5 rounded-xl outline-none transition-all"
                />

                <button
                  onClick={async () => {
                    const file = faceTraceFileRef.current?.files[0];
                    if (!file) return;
                    setFaceTraceLoading(true);
                    setFaceTraceResult(null);
                    try {
                      const fd = new FormData();
                      fd.append('photo', file);
                      fd.append('subject_name', faceTraceSubject || 'Unknown');
                      const res = await axios.post('http://localhost:8000/api/v1/facetrace/search', fd, {
                        headers: {'Content-Type': 'multipart/form-data'}
                      });
                      setFaceTraceResult(res.data);
                    } catch(e) {
                      alert('Search failed: ' + (e.response?.data?.detail || e.message));
                    } finally {
                      setFaceTraceLoading(false);
                    }
                  }}
                  disabled={faceTraceLoading || !faceTracePreview}
                  className="w-full py-3 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 text-white disabled:text-slate-500 flex items-center justify-center gap-2"
                >
                  {faceTraceLoading ? (
                    <><span className="animate-spin">⚙️</span> Scanning {(12).toString()} cams...</>
                  ) : (
                    <>🔍 Search CCTV Grid</>
                  )}
                </button>

                {/* Face analysis result */}
                {faceTraceResult && (
                  <div className="bg-[#161e33] rounded-xl p-3 border border-purple-500/20">
                    <p className="text-purple-400 text-[9px] font-black tracking-widest uppercase mb-2">AI Face Analysis</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-slate-500">Age</span><span className="text-white font-bold">~{faceTraceResult.face_analysis?.estimated_age}y</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Gender</span><span className="text-white font-bold">{faceTraceResult.face_analysis?.gender}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Emotion</span><span className="text-white font-bold capitalize">{faceTraceResult.face_analysis?.emotion}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Confidence</span><span className="text-emerald-400 font-bold">{Math.round((faceTraceResult.face_analysis?.face_confidence || 0) * 100)}%</span></div>
                    </div>
                    <p className="text-[8px] text-slate-600 mt-2">{faceTraceResult.face_analysis?.source}</p>
                  </div>
                )}
              </div>

              {/* RIGHT: Results */}
              <div className="flex-1 overflow-y-auto p-5">
                {!faceTraceResult && !faceTraceLoading && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <span className="text-6xl mb-4">🔍</span>
                    <p className="text-slate-400 text-sm font-bold">Upload a photo to search</p>
                    <p className="text-slate-600 text-xs mt-2">DeepFace will analyze and scan {(12).toString()} CCTV cameras across Indore</p>
                  </div>
                )}

                {faceTraceLoading && (
                  <div className="h-full flex flex-col items-center justify-center gap-4">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin"></div>
                      <span className="absolute inset-0 flex items-center justify-center text-3xl">📷</span>
                    </div>
                    <p className="text-purple-400 font-bold">DeepFace analyzing...</p>
                    <p className="text-slate-500 text-sm">Scanning 12 cameras across Indore</p>
                  </div>
                )}

                {faceTraceResult && (
                  <div>
                    {/* Status banner */}
                    <div className={`rounded-2xl p-4 mb-4 border ${
                      faceTraceResult.status === 'LOCATED'
                        ? 'bg-emerald-900/30 border-emerald-500/40'
                        : 'bg-red-900/20 border-red-500/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{faceTraceResult.status === 'LOCATED' ? '🟢' : '🔴'}</span>
                        <div>
                          <p className={`font-black text-lg ${faceTraceResult.status === 'LOCATED' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {faceTraceResult.status === 'LOCATED' ? `Subject Located!` : 'Not Found'}
                          </p>
                          <p className="text-slate-400 text-sm">
                            {faceTraceResult.matches_found} match(es) across {faceTraceResult.cameras_scanned} cameras
                            {faceTraceResult.best_match && ` • Last seen: ${faceTraceResult.best_match.camera_name}`}
                          </p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-slate-500 text-[10px]">Search ID</p>
                          <p className="text-white font-mono text-sm font-bold">{faceTraceResult.search_id}</p>
                        </div>
                      </div>
                    </div>

                    {/* Camera results grid */}
                    <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase mb-3">Camera Scan Results</p>
                    <div className="grid grid-cols-2 gap-2">
                      {faceTraceResult.camera_results?.map(cam => (
                        <div
                          key={cam.camera_id}
                          className={`rounded-xl p-3 border transition-all ${
                            cam.is_match
                              ? cam.confidence > 85 ? 'bg-emerald-900/30 border-emerald-500/40' : 'bg-amber-900/20 border-amber-500/30'
                              : 'bg-[#161e33] border-[#2d3748]/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-[11px] font-bold text-white leading-tight max-w-[120px]">{cam.camera_name}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ml-1 ${
                              cam.is_match
                                ? cam.confidence > 85 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-700 text-slate-500'
                            }`}>{cam.confidence}%</span>
                          </div>
                          {/* Confidence bar */}
                          <div className="h-1 bg-[#0a0f1d] rounded-full overflow-hidden mb-1">
                            <div
                              className={`h-full rounded-full ${
                                cam.confidence > 85 ? 'bg-emerald-400' :
                                cam.confidence > 60 ? 'bg-amber-400' : 'bg-slate-600'
                              }`}
                              style={{width: `${cam.confidence}%`}}
                            />
                          </div>
                          <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">{cam.zone}</span>
                            {cam.is_match && <span className="text-slate-400">🕐 {cam.last_seen}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ─── JAL SHAKTI FLOATING BUTTON ─── */}
      <button
        onClick={toggleJalShakti}
        className={`fixed bottom-60 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 hover:scale-110 ${
          waterAlerts.length > 0
            ? 'bg-gradient-to-br from-cyan-400 to-blue-600 animate-pulse'
            : 'bg-gradient-to-br from-sky-500 to-cyan-600'
        }`}
        title="Jal Shakti Water Monitoring"
      >
        <span className="text-2xl">💧</span>
        {waterAlerts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[9px] text-white font-black flex items-center justify-center">{waterAlerts.length}</span>
        )}
      </button>

      {/* ─── JAL SHAKTI PANEL ─── */}
      {showJalShakti && (
        <div className="fixed right-0 top-0 h-full w-[420px] z-[150] bg-[#060d1f]/95 border-l border-cyan-500/20 backdrop-blur-2xl flex flex-col overflow-hidden shadow-[-20px_0_60px_rgba(6,182,212,0.15)]">

          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border-b border-cyan-500/20 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xl">💧</div>
                <div>
                  <h2 className="text-white font-black text-base tracking-wider">Jal Shakti Monitor</h2>
                  <p className="text-cyan-400 text-[10px] font-mono tracking-widest uppercase">LSTM · 8 IMC Zones · Live IoT</p>
                </div>
              </div>
              <button onClick={toggleJalShakti} className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/30 border border-red-500/30 text-red-400 flex items-center justify-center font-bold text-xs transition-all">✕</button>
            </div>

            {/* Summary bar */}
            {waterSummary && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { label: 'Zones', value: waterSummary.total_zones, color: 'text-cyan-400' },
                  { label: 'Critical', value: waterSummary.critical_zones, color: 'text-red-400' },
                  { label: 'Low', value: waterSummary.low_zones, color: 'text-amber-400' },
                  { label: 'Avg Level', value: `${waterSummary.avg_tank_level_pct}%`, color: 'text-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#0d1729] rounded-lg p-2 text-center border border-[#1e293b]">
                    <p className={`font-black text-base ${color}`}>{value}</p>
                    <p className="text-slate-500 text-[9px] uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Active Alerts */}
            {waterAlerts.length > 0 && (
              <div className="px-4 pt-4">
                <p className="text-[10px] font-black tracking-widest text-red-400 uppercase mb-2">🚨 Active Alerts</p>
                {waterAlerts.map(alert => (
                  <div key={alert.id} className={`mb-2 p-3 rounded-xl border text-xs ${
                    alert.severity === 'P1'
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    <div className="flex justify-between items-start">
                      <p className="font-bold leading-tight">{alert.message}</p>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black flex-shrink-0 ${
                        alert.severity === 'P1' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                      }`}>{alert.severity}</span>
                    </div>
                    <p className="text-slate-500 mt-1">{alert.affected_households?.toLocaleString()} households · AI: {alert.ai_confidence}% confidence</p>
                  </div>
                ))}
              </div>
            )}

            {/* Zone Cards */}
            <div className="px-4 pt-3 pb-4">
              <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">💧 Zone Status</p>
              {waterZones.map(zone => (
                <div
                  key={zone.zone_id}
                  onClick={() => {
                    setSelectedWaterZone(selectedWaterZone?.zone_id === zone.zone_id ? null : zone);
                    if (selectedWaterZone?.zone_id !== zone.zone_id) fetchZonePrediction(zone.zone_id);
                  }}
                  className={`mb-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedWaterZone?.zone_id === zone.zone_id
                      ? 'border-cyan-400/50 bg-cyan-500/10'
                      : 'border-[#1e293b] bg-[#0d1729] hover:border-[#2d3748]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zone.color }}></div>
                      <span className="text-white font-bold text-[11px]">{zone.zone_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${
                      zone.status === 'CRITICAL' ? 'bg-red-500/15 border-red-500/40 text-red-400'
                      : zone.status === 'LOW' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : zone.status === 'FULL' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    }`}>{zone.status}</span>
                  </div>

                  {/* Tank level bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                      <span>Tank Level</span>
                      <span className="font-bold text-white">{zone.tank_level_pct}% ({zone.tank_level_ML} ML)</span>
                    </div>
                    <div className="w-full bg-[#1e293b] rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${zone.tank_level_pct}%`,
                          backgroundColor: zone.tank_level_pct < 15 ? '#ef4444' : zone.tank_level_pct < 30 ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  {/* Sensor readings row */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {[
                      { label: 'Pressure', value: `${zone.pressure_bar} bar` },
                      { label: 'Flow', value: `${zone.flow_lpm} L/min` },
                      { label: 'Supply', value: zone.supply_active ? '🟢 Active' : '🔴 Off' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[#060d1f] rounded-lg p-1.5 text-center">
                        <p className="text-white text-[10px] font-bold">{value}</p>
                        <p className="text-slate-500 text-[8px]">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Water quality */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400">Quality:</span>
                    <span className={`text-[9px] font-bold ${zone.water_quality?.is_safe ? 'text-emerald-400' : 'text-red-400'}`}>
                      {zone.water_quality?.is_safe ? '✅ Safe' : '⚠️ Alert'}
                    </span>
                    <span className="text-[9px] text-slate-500">pH {zone.water_quality?.ph} · {zone.water_quality?.turbidity_ntu} NTU · {zone.water_quality?.chlorine_mgl} mg/L Cl</span>
                  </div>

                  {/* Expanded: LSTM Prediction */}
                  {selectedWaterZone?.zone_id === zone.zone_id && (
                    <div className="mt-3 pt-3 border-t border-[#1e293b]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">🤖 24h LSTM Forecast</p>
                        {waterLoading && <div className="w-3 h-3 border-2 border-t-cyan-400 border-cyan-500/20 rounded-full animate-spin" />}
                      </div>
                      {waterPrediction && (
                        <>
                          <div className="flex gap-3 mb-2">
                            <div className="flex-1 bg-[#060d1f] rounded-lg p-2 text-center">
                              <p className={`font-black text-sm ${
                                waterPrediction.risk_level === 'CRITICAL' ? 'text-red-400'
                                : waterPrediction.risk_level === 'WARNING' ? 'text-amber-400'
                                : 'text-emerald-400'
                              }`}>{waterPrediction.risk_level}</p>
                              <p className="text-slate-500 text-[8px]">Risk Level</p>
                            </div>
                            <div className="flex-1 bg-[#060d1f] rounded-lg p-2 text-center">
                              <p className="text-cyan-400 font-black text-sm">{waterPrediction.ai_confidence}%</p>
                              <p className="text-slate-500 text-[8px]">AI Confidence</p>
                            </div>
                            <div className="flex-1 bg-[#060d1f] rounded-lg p-2 text-center">
                              <p className="text-white font-black text-sm">{waterPrediction.min_predicted_level_pct}%</p>
                              <p className="text-slate-500 text-[8px]">Min Level</p>
                            </div>
                          </div>

                          {/* Mini 24h bar chart */}
                          <p className="text-[8px] text-slate-500 mb-1">24-hour supply forecast (tank level %)</p>
                          <div className="flex items-end gap-0.5 h-12">
                            {waterPrediction.forecast_hours.slice(0, 24).map((fh, i) => (
                              <div
                                key={i}
                                className="flex-1 rounded-sm transition-all"
                                style={{
                                  height: `${Math.max(4, fh.level_pct)}%`,
                                  backgroundColor: fh.has_supply
                                    ? fh.level_pct > 50 ? '#10b981'
                                    : fh.level_pct > 20 ? '#f59e0b'
                                    : '#ef4444'
                                    : '#1e293b',
                                }}
                                title={`${fh.hour_label}: ${fh.level_pct}%`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[7px] text-slate-600 mt-0.5">
                            <span>Now</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span>
                          </div>

                          {waterPrediction.predicted_supply_cuts.length > 0 && (
                            <p className="mt-2 text-[9px] text-red-400 font-bold">
                              ⚠️ Supply cuts expected at: {waterPrediction.predicted_supply_cuts.slice(0,4).join(', ')}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#1e293b] flex-shrink-0">
            <p className="text-[9px] text-slate-600 text-center">💧 Jal Shakti IoT · LSTM prediction · Indore Municipal Corporation · 8 zones · 715,000 residents</p>
          </div>
        </div>
      )}

      {/* ─── AI CHALLAN FLOATING BUTTON ─── */}
      <button
        onClick={() => { setShowChallan(true); setChallanFile(null); setChallanResult(null); }}
        className="fixed bottom-[304px] right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)] bg-gradient-to-br from-amber-400 to-orange-600 hover:scale-110 transition-all duration-300"
        title="AI Challan Dispute Engine"
      >
        <span className="text-2xl">🧾</span>
      </button>

      {/* ─── AI CHALLAN MODAL ─── */}
      {showChallan && (
        <div className="fixed inset-0 z-[200] bg-[#060d1f]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl border border-amber-500/30 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">⚖️</div>
                <div>
                  <h2 className="text-white font-black text-xl tracking-wide">AI Challan Dispute Engine</h2>
                  <p className="text-amber-400 text-xs font-mono tracking-widest uppercase">OCR Extraction · NLP Validation · PDF Auto-Gen</p>
                </div>
              </div>
              <button onClick={() => setShowChallan(false)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-5 gap-6">
                
                {/* Left: Upload & Preview */}
                <div className="col-span-2 flex flex-col gap-4">
                  <input type="file" ref={challanFileRef} onChange={handleChallanUpload} accept="image/*" className="hidden" />
                  
                  {!challanFile ? (
                    <button
                      onClick={() => challanFileRef.current?.click()}
                      className="border-2 border-dashed border-amber-500/30 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 transition-all py-12 flex flex-col items-center justify-center text-amber-500/70 hover:text-amber-400"
                    >
                      <span className="text-4xl mb-3">📸</span>
                      <span className="font-bold text-sm tracking-wide">Take Photo of Challan</span>
                      <span className="text-[10px] mt-1 font-mono uppercase">PNG, JPG format</span>
                    </button>
                  ) : (
                    <div className="relative rounded-xl border border-amber-500/30 overflow-hidden bg-black/50 group">
                      <img src={challanFile} className="w-full h-auto object-contain max-h-[500px]" alt="Challan" />
                      <button 
                        onClick={() => challanFileRef.current?.click()}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-white tracking-widest uppercase text-sm"
                      >
                        Rescan Different Photo
                      </button>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700">
                    <h3 className="text-slate-300 font-bold text-xs uppercase tracking-widest mb-2">How it works</h3>
                    <ul className="text-slate-400 text-xs space-y-1.5 list-disc pl-4">
                      <li>Scan a physical traffic challan using your camera</li>
                      <li>EasyOCR extracts all relevant details automatically</li>
                      <li>NLP engine validates fields against MVA 2019 rules</li>
                      <li>If defective, a formal Dispute PDF is generated</li>
                    </ul>
                  </div>
                </div>

                {/* Right: Results Dashboard */}
                <div className="col-span-3">
                  {challanLoading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                      <p className="text-amber-400 font-mono tracking-widest animate-pulse text-sm">ANALYZING DOCUMENT...</p>
                    </div>
                  ) : challanResult ? (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      {/* Validity Scorecard */}
                      <div className="bg-[#1e293b] rounded-xl p-5 border border-slate-700 flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">MVA Validity Score</p>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-4xl font-black ${challanResult.validity.validity_score < 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {challanResult.validity.validity_score}
                            </span>
                            <span className="text-slate-500 text-lg font-bold">/ 100</span>
                          </div>
                          <p className="text-white font-bold text-sm mt-1">{challanResult.validity.summary}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border ${
                            challanResult.validity.recommendation.includes('STRONG') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 
                            challanResult.validity.recommendation.includes('MODERATE') ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' :
                            'bg-red-500/20 text-red-400 border-red-500/50'
                          }`}>
                            {challanResult.validity.recommendation.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Details Extracted */}
                      <div>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-700 pb-2 mb-3">Extracted Details</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#0b1120] p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 text-[9px] uppercase tracking-widest block mb-1">Vehicle No.</span>
                            <span className="text-white font-mono font-bold text-sm">{challanResult.fields.vehicle_number || 'N/A'}</span>
                          </div>
                          <div className="bg-[#0b1120] p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 text-[9px] uppercase tracking-widest block mb-1">Challan Date</span>
                            <span className="text-white font-bold text-sm">{challanResult.fields.challan_date_raw || 'N/A'}</span>
                          </div>
                          <div className="bg-[#0b1120] p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 text-[9px] uppercase tracking-widest block mb-1">Fine Amount</span>
                            <span className="text-red-400 font-bold text-sm">₹{challanResult.fields.fine_amount || 'N/A'}</span>
                          </div>
                          <div className="bg-[#0b1120] p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-500 text-[9px] uppercase tracking-widest block mb-1">Offense</span>
                            <span className="text-white font-bold text-xs">{challanResult.fields.offense_description || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Dispute Grounds */}
                      {challanResult.validity.grounds.length > 0 && (
                        <div>
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-700 pb-2 mb-3">Grounds for Legal Dispute</p>
                          <div className="space-y-2">
                            {challanResult.validity.grounds.map((g, i) => (
                              <div key={i} className={`p-3 rounded-lg border text-xs ${
                                g.severity === 'HIGH' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
                              }`}>
                                <div className="flex justify-between font-bold mb-1">
                                  <span className={g.severity === 'HIGH' ? 'text-red-300' : 'text-amber-300'}>{g.description}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest ${
                                    g.severity === 'HIGH' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                                  }`}>{g.severity} Defect</span>
                                </div>
                                <span className="text-slate-400 text-[10px]">⚖️ {g.legal_basis}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-[#0b1120]">
                      <span className="text-5xl mb-4 opacity-50">⚖️</span>
                      <p className="font-medium text-sm">Please upload a challan to analyze</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer with actions */}
            <div className="p-4 bg-[#1e293b] border-t border-slate-700 flex justify-between items-center">
              <p className="text-slate-400 text-xs">Analysis powered by EasyOCR and DeepSeek NLP.</p>
              
              <button
                onClick={downloadChallanPdf}
                disabled={!challanResult?.pdf_base64}
                className={`px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg flex items-center gap-2 ${
                  challanResult?.pdf_base64 
                    ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-amber-500/20' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600'
                }`}
              >
                <span>📄</span> Auto-Generate Dispute Letter PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DIGITAL TWIN FLOATING BUTTON ─── */}
      <button
        onClick={() => setShowDigitalTwin(true)}
        className="fixed bottom-44 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] bg-gradient-to-br from-cyan-500 to-blue-600 hover:scale-110 transition-all duration-300"
        title="3D Digital Twin Map"
      >
        <span className="text-2xl">🌐</span>
      </button>

      {/* ─── DIGITAL TWIN FULL-SCREEN VIEW ─── */}
      {showDigitalTwin && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 animate-spin"></div>
                <span className="absolute inset-0 flex items-center justify-center text-4xl">🌐</span>
              </div>
              <p className="text-cyan-400 font-black text-xl">Loading Digital Twin...</p>
            </div>
          </div>
        }>
          <DigitalTwin onClose={() => setShowDigitalTwin(false)} />
        </Suspense>
      )}

    </div>
  );
}

export default App;