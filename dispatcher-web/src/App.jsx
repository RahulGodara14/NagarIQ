import { useEffect, useState, useRef, lazy, Suspense } from 'react';
const DigitalTwin = lazy(() => import('./DigitalTwin.jsx'));
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import {
  ShieldAlert, MapPin, Clock, AlertTriangle, CheckCircle2, Navigation,
  Layers, Search, Radio, Award, Droplets, Camera, FileText,
  Bot, Shield, X, Maximize2, RefreshCw, ChevronRight, Activity,
  Sliders, Siren, UserCheck, Flame, Wind, Bus, School, Eye, Compass
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip, Polyline, Polygon, useMapEvents, ZoomControl } from 'react-leaflet';
import HeatmapLayer from './HeatmapLayer.jsx';
import { API_URL, WS_URL } from './config.js';

// --- LEAFLET CUSTOM MAP ICONS ---
const pulsingRedIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-5 h-5 bg-red-600 rounded-full border-2 border-white animate-ping absolute -left-2.5 -top-2.5"></div>
         <div class="w-5 h-5 bg-red-600 rounded-full border-2 border-white absolute -left-2.5 -top-2.5 shadow-[0_0_12px_rgba(239,68,68,0.8)]"></div>`,
  iconSize: [0, 0],
});

const pulsingYellowIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-5 h-5 bg-amber-500 rounded-full border-2 border-white animate-ping absolute -left-2.5 -top-2.5"></div>
         <div class="w-5 h-5 bg-amber-500 rounded-full border-2 border-white absolute -left-2.5 -top-2.5 shadow-[0_0_12px_rgba(245,158,11,0.8)]"></div>`,
  iconSize: [0, 0],
});

const ambulanceIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-8 h-8 bg-blue-700 rounded-lg border-2 border-white flex items-center justify-center shadow-lg transform -rotate-45 hover:scale-110 transition-transform">
            <span class="text-white text-xs font-bold rotate-45">🚑</span>
         </div>`,
  iconSize: [32, 32],
});

const volunteerIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="relative flex h-5 w-5 items-center justify-center">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-[0_0_10px_rgba(37,99,235,0.8)]"></span>
         </div>`,
  iconSize: [20, 20],
});

const grievanceIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-7 h-7 bg-purple-700 rounded-full border-2 border-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
            <span class="text-white text-[11px] font-bold">🏗️</span>
         </div>`,
  iconSize: [28, 28],
});

const cctvIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-7 h-7 bg-amber-600 rounded-lg border-2 border-white flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.6)] hover:scale-110 transition-transform">
            <span class="text-white text-[13px]">📹</span>
         </div>`,
  iconSize: [28, 28],
});

const cctvAlertIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-8 h-8 bg-red-600 rounded-lg border-2 border-white flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-bounce">
            <span class="text-white text-[14px]">🚨</span>
         </div>`,
  iconSize: [32, 32],
});

const hospitalIcon = (status) => L.divIcon({
  className: 'custom-icon',
  html: `<div class="flex flex-col items-center">
    <div class="w-9 h-9 rounded-xl border-2 flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
      status === 'AVAILABLE' ? 'bg-emerald-700 border-emerald-300 shadow-emerald-500/50' :
      status === 'BUSY' ? 'bg-amber-600 border-amber-300 shadow-amber-500/50' :
      'bg-red-700 border-red-300 shadow-red-500/50'
    }">
      <span class="text-white text-base font-black">🏥</span>
    </div>
  </div>`,
  iconSize: [36, 42],
  iconAnchor: [18, 42],
});

const schoolIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div class="w-7 h-7 bg-sky-600 rounded-lg border-2 border-white flex items-center justify-center shadow-[0_0_10px_rgba(14,165,233,0.6)] hover:scale-110 transition-transform">
            <span class="text-white text-[13px]">🎓</span>
         </div>`,
  iconSize: [28, 28],
});

const heatZoneIcon = (riskLevel) => {
  const borderColor = riskLevel === 'CRITICAL' ? 'border-red-500' :
                      riskLevel === 'HIGH' ? 'border-orange-500' : 'border-yellow-500';
  const shadowColor = riskLevel === 'CRITICAL' ? 'shadow-red-500/50' :
                      riskLevel === 'HIGH' ? 'shadow-orange-500/50' : 'shadow-yellow-500/50';
  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="relative w-8 h-8 rounded-full border-2 bg-slate-900/95 ${borderColor} flex items-center justify-center shadow-[0_0_8px_rgba(0,0,0,0.5)] ${shadowColor} transform hover:scale-110 transition-transform">
             <span class="text-white text-[13px]">🌡️</span>
             <span class="absolute -bottom-1 -right-1 text-[11px] animate-pulse">⚠️</span>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// --- GEOFENCE DRAWER COMPONENT ---
function GeofenceDrawer({ active, points, setPoints }) {
  useMapEvents({
    click(e) {
      if (active) {
        setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      }
    },
    contextmenu(e) {
      if (active && points.length > 0) {
        setPoints((prev) => prev.slice(0, -1));
      }
    }
  });

  if (!active || points.length === 0) return null;

  return (
    <>
      {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.35, weight: 2 }} />}
      {points.map((pt, i) => (
        <CircleMarker key={i} center={pt} radius={5} pathOptions={{ color: '#ef4444', fillColor: 'white', fillOpacity: 1, weight: 2 }} />
      ))}
      {points.length > 1 && (
        <Polyline positions={points} pathOptions={{ color: '#ef4444', dashArray: '6, 6', weight: 2 }} />
      )}
    </>
  );
}

function App() {
  // --- CORE INCIDENT STATE ---
  const [incidents, setIncidents] = useState([]);
  const [incidentFilter, setIncidentFilter] = useState('all'); // all, active, dispatched, resolved
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // --- LIVE TELEMETRY CLOCK ---
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- VAYU AQI STATE ---
  const [showAQI, setShowAQI] = useState(false);
  const [aqiData, setAqiData] = useState([]);

  // --- ROUTING & UNITS STATE ---
  const [units, setUnits] = useState([]);
  const [activeRoutes, setActiveRoutes] = useState({});

  // --- PREDICTIVE AI HEATMAP STATE ---
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);

  // --- TRAFFIC PREDICTION STATE ---
  const [showTraffic, setShowTraffic] = useState(false);
  const [trafficData, setTrafficData] = useState([]);

  // --- CITY HEALTH (GRIEVANCES) STATE ---
  const [showGrievances, setShowGrievances] = useState(false);
  const [grievances, setGrievances] = useState([]);

  // --- PARIVAHAN ANPR STATE ---
  const [showParivahan, setShowParivahan] = useState(false);
  const [cctvCameras, setCctvCameras] = useState([]);
  const [violations, setViolations] = useState([]);
  const [showViolationsPanel, setShowViolationsPanel] = useState(false);
  const anprScanIntervalRef = useRef(null);

  // --- MEDATA: HOSPITAL ROUTING STATE ---
  const [showMedETA, setShowMedETA] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [medRoute, setMedRoute] = useState(null);
  const [medRouteLoading, setMedRouteLoading] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);

  // --- FLOODWATCH IOT STATE ---
  const [showFlood, setShowFlood] = useState(false);
  const [floodSensors, setFloodSensors] = useState([]);
  const [floodSummary, setFloodSummary] = useState(null);
  const floodIntervalRef = useRef(null);

  // --- AI CHALLAN DISPUTE STATE ---
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
    formData.append('citizen_name', 'Rahul Sharma');

    try {
      const res = await axios.post(`${API_URL}/api/v1/challan/dispute`, formData);
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

  // --- FACETRACE: MISSING PERSON STATE ---
  const [showFaceTrace, setShowFaceTrace] = useState(false);
  const [faceTraceLoading, setFaceTraceLoading] = useState(false);
  const [faceTraceResult, setFaceTraceResult] = useState(null);
  const [faceTraceSubject, setFaceTraceSubject] = useState('');
  const [faceTracePreview, setFaceTracePreview] = useState(null);
  const faceTraceFileRef = useRef(null);

  // --- DIGITAL TWIN STATE ---
  const [showDigitalTwin, setShowDigitalTwin] = useState(false);

  // --- NAGARSEVA VOLUNTEERS STATE ---
  const [showVolunteers, setShowVolunteers] = useState(false);
  const [volunteers, setVolunteers] = useState([]);

  // --- HEAT ISLAND RISK ENGINE STATE ---
  const [showHeat, setShowHeat] = useState(false);
  const [heatZones, setHeatZones] = useState([]);
  const [heatAlerts, setHeatAlerts] = useState([]);

  // --- NAGARSCORE GAMIFICATION STATE ---
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);

  // --- NAGARYATRA SMART TRANSIT STATE ---
  const [showTransit, setShowTransit] = useState(false);
  const [liveBuses, setLiveBuses] = useState([]);
  const [busStops, setBusStops] = useState([]);
  const transitIntervalRef = useRef(null);

  // --- JAL SHAKTI: WATER MONITORING STATE ---
  const [showJalShakti, setShowJalShakti] = useState(false);
  const [waterZones, setWaterZones] = useState([]);
  const [waterAlerts, setWaterAlerts] = useState([]);
  const [waterSummary, setWaterSummary] = useState(null);
  const [selectedWaterZone, setSelectedWaterZone] = useState(null);
  const [waterPrediction, setWaterPrediction] = useState(null);
  const [waterLoading, setWaterLoading] = useState(false);
  const waterIntervalRef = useRef(null);

  // --- NAGARSANKAT GEOFENCE ALERT STATE ---
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
        axios.get(`${API_URL}/api/v1/vidya/schools`),
        axios.get(`${API_URL}/api/v1/vidya/events`),
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
      await axios.post(`${API_URL}/api/v1/nagarsankat/broadcast`, {
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
        axios.get(`${API_URL}/api/v1/water/zones`),
        axios.get(`${API_URL}/api/v1/water/alerts`),
      ]);
      setWaterZones(zonesRes.data.zones || []);
      setWaterSummary(zonesRes.data.summary || null);
      setWaterAlerts(alertsRes.data.alerts || []);
    } catch (e) { console.error('[JalShakti] Fetch error:', e); }
  };

  const fetchZonePrediction = async (zoneId) => {
    try {
      setWaterLoading(true);
      const res = await axios.get(`${API_URL}/api/v1/water/predict/${zoneId}`);
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
    { role: 'aria', text: "Namaste Officer! I am **ARIA**, the AI Co-Pilot for Indore Smart City ICCC. Ask me anything — *'Show active incidents'*, *'Find nearest idle unit'*, *'City stats'*, or *'Suggest dispatch priority'*.", tool: 'greet', time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }
  ]);
  const [ariaInput, setAriaInput] = useState('');
  const [ariaLoading, setAriaLoading] = useState(false);
  const ariaBottomRef = useRef(null);

  const toggleAQI = async () => {
    if (!showAQI) {
      try {
        const res = await axios.get(`${API_URL}/api/v1/environment/aqi`);
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
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#eab308';
    if (aqi <= 200) return '#f97316';
    if (aqi <= 300) return '#ef4444';
    return '#a855f7';
  };

  const updateStatus = async (incidentId, newStatus, unit = null) => {
    try {
      const payload = { status: newStatus };
      if (unit) payload.assigned_unit = unit;

      await axios.patch(`${API_URL}/api/v1/incidents/${incidentId}/status`, payload);
      fetchIncidents();
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/v1/routing/units`);
      if (res.data.status === 'success') {
        setUnits(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching units", error);
    }
  };

  const fetchVolunteers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/v1/volunteers`);
      if (res.data.status === 'success') {
        setVolunteers(res.data.volunteers);
      }
    } catch (error) {
      console.error("Error fetching volunteers", error);
    }
  };

  const fetchHeatData = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/v1/heat/zones`);
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
      const res = await axios.get(`${API_URL}/api/v1/nagarscore/leaderboard`);
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
      updateStatus(incident.id, 'dispatched', selectedUnit.id);
      axios.patch(`${API_URL}/api/v1/routing/units/${selectedUnit.id}`, { status: 'en_route' }).catch(e => console.error(e));

      try {
        const routeRes = await axios.get(`${API_URL}/api/v1/routing/path`, {
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
            const nextPoint = route.polyline[0];
            const remainingPath = route.polyline.slice(1);
            newRoutes[incidentId] = {
              ...route,
              polyline: remainingPath
            };
            anyMoved = true;

            if (route.unitId) {
              const updatePayload = {
                lat: nextPoint[0],
                lng: nextPoint[1]
              };
              
              if (remainingPath.length === 0) {
                updatePayload.status = 'idle';
                updateStatus(incidentId, 'resolved', route.unitId);
              }

              axios.patch(`${API_URL}/api/v1/routing/units/${route.unitId}`, updatePayload)
                .catch(e => console.error("Unit move failed", e));
            }
          }
        });

        return anyMoved ? newRoutes : prevRoutes;
      });
    }, 1000);

    return () => clearInterval(moveInterval);
  }, []);

  const toggleTraffic = async () => {
    setShowTraffic(!showTraffic);
    if (!showTraffic) {
      try {
        const res = await axios.get(`${API_URL}/api/v1/traffic/predict`);
        setTrafficData(res.data.forecast);
      } catch (e) { console.log("Traffic fetch failed", e); }
    }
  };

  const toggleHeatmap = async () => {
    setShowHeatmap(!showHeatmap);
    if (!showHeatmap) {
      try {
        const res = await axios.get(`${API_URL}/api/v1/analytics/hotspots`);
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
        const res = await axios.get(`${API_URL}/api/v1/grievances`);
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
        const res = await axios.get(`${API_URL}/api/v1/medata/hospitals`);
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
      const res = await axios.post(`${API_URL}/api/v1/medata/route`, {
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
      const res = await axios.get(`${API_URL}/api/v1/flood/sensors`);
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
        axios.get(`${API_URL}/api/v1/transit/buses`),
        axios.get(`${API_URL}/api/v1/transit/stops`),
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
      try {
        const res = await axios.get(`${API_URL}/api/v1/anpr/cameras`);
        if (res.data.status === 'success') setCctvCameras(res.data.cameras);
      } catch (e) { console.log('Camera fetch failed', e); }
      try {
        const res2 = await axios.get(`${API_URL}/api/v1/anpr/violations`);
        if (res2.data.status === 'success') setViolations(res2.data.violations);
      } catch (e) {}

      let camIdx = 0;
      anprScanIntervalRef.current = setInterval(async () => {
        const camId = CAMERAS[camIdx % CAMERAS.length];
        camIdx++;
        try {
          const res = await axios.post(`${API_URL}/api/v1/anpr/scan/${camId}`);
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
      const res = await axios.get(`${API_URL}/api/v1/incidents`);
      if (res.data.status === 'success') {
        const incoming = res.data.data;
        setIncidents(incoming);
        
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
    const ws = new WebSocket(`${WS_URL}/ws/drishti/${incidentId}/view`);
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
      const res = await axios.post(`${API_URL}/api/v1/aria/chat`, { message: msg });
      const ariaMsg = {
        role: 'aria',
        text: res.data.response,
        tool: res.data.tool_used,
        time: res.data.timestamp,
      };
      setAriaMessages(prev => [...prev, ariaMsg]);
    } catch (err) {
      setAriaMessages(prev => [...prev, { role: 'aria', text: '⚠️ Connection timeout with the central ICCC intelligence server. Please ensure backend services are online.', tool: 'error', time: '--:--' }]);
    } finally {
      setAriaLoading(false);
      setTimeout(() => ariaBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // Filtered incidents
  const filteredIncidents = incidents.filter(inc => {
    if (incidentFilter === 'active' && inc.status !== 'active') return false;
    if (incidentFilter === 'dispatched' && inc.status !== 'dispatched') return false;
    if (incidentFilter === 'resolved' && inc.status !== 'resolved') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = inc.id?.toLowerCase().includes(q);
      const matchType = inc.incident_type?.toLowerCase().includes(q);
      const matchAddr = inc.address?.toLowerCase().includes(q);
      const matchDesc = inc.description?.toLowerCase().includes(q);
      return matchId || matchType || matchAddr || matchDesc;
    }
    return true;
  });

  const unresolvedCount = incidents.filter(i => i.status !== 'resolved').length;
  const criticalCount = incidents.filter(i => i.status !== 'resolved' && (i.incident_type?.toLowerCase().includes('fire') || i.incident_type?.toLowerCase().includes('flood') || i.incident_type?.toLowerCase().includes('accident'))).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07111e] text-slate-100 overflow-hidden select-none">
      
      {/* 🇮🇳 NATIONAL TRICOLOR TOP STRIPE */}
      <div className="tricolor-ribbon shrink-0"></div>

      {/* 🏛️ OFFICIAL GOVERNMENT HEADER BAR (GIGW / MoHUA STANDARD) */}
      <header className="h-[64px] bg-[#0c182b] border-b border-[#1b2f4a] px-4 flex items-center justify-between shrink-0 z-30 shadow-md relative gap-3">
        
        {/* Left: Emblem & Institutional Identity */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Ashoka Chakra / Government Insignia Badge */}
          <div className="w-10 h-10 rounded-lg ashoka-badge flex items-center justify-center border border-blue-400/40 shadow-inner relative shrink-0" title="Integrated Command and Control Centre">
            <Shield className="w-5 h-5 text-blue-300" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5 leading-none mb-1">
              <span className="text-[10px] font-bold text-amber-400 tracking-wide uppercase whitespace-nowrap">
                मध्य प्रदेश शासन • नगरीय विकास एवं आवास विभाग
              </span>
              <span className="text-slate-600 text-[10px]">|</span>
              <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase whitespace-nowrap hidden sm:inline">
                ISCDL / IMC
              </span>
            </div>
            <div className="flex items-center gap-2 leading-none">
              <h1 className="text-sm sm:text-base font-black tracking-wide text-white font-rajdhani uppercase whitespace-nowrap">
                नगर आईक्यू <span className="text-sky-400">NagarIQ</span> — ICCC DISPATCH CONSOLE
              </h1>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-[8px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Command Telemetry Chips (visible on 2XL / wide displays) */}
        <div className="hidden 2xl:flex items-center gap-2 bg-[#07111e]/90 border border-[#1b2f4a] rounded-xl px-3 py-1 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-red-500/30 bg-red-950/40">
            <Siren className="w-3 h-3 text-red-400 animate-pulse" />
            <span className="text-slate-400 font-semibold uppercase text-[9px]">Alerts:</span>
            <span className="font-bold text-red-400 font-mono">{unresolvedCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-blue-500/30 bg-blue-950/40">
            <Navigation className="w-3 h-3 text-blue-400" />
            <span className="text-slate-400 font-semibold uppercase text-[9px]">Units:</span>
            <span className="font-bold text-blue-300 font-mono">{units.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/40">
            <UserCheck className="w-3 h-3 text-emerald-400" />
            <span className="text-slate-400 font-semibold uppercase text-[9px]">NagarSeva:</span>
            <span className="font-bold text-emerald-300 font-mono">{volunteers.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-amber-500/30 bg-amber-950/40">
            <Camera className="w-3 h-3 text-amber-400" />
            <span className="text-slate-400 font-semibold uppercase text-[9px]">CCTV:</span>
            <span className="font-bold text-amber-300 font-mono">12 LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/40">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400 font-semibold uppercase text-[9px]">Water:</span>
            <span className="font-bold text-cyan-300 font-mono">8 ZONES</span>
          </div>
        </div>

        {/* Right: Real-time IST Digital Clock & Global Executive Tools */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* IST Digital Clock */}
          <div className="text-right hidden md:block border-r border-[#1b2f4a] pr-3 shrink-0">
            <div className="text-white font-rajdhani font-bold text-sm tracking-wider uppercase leading-tight">
              {currentTime.toLocaleTimeString('en-IN', { hour12: false })} <span className="text-[9px] text-sky-400 font-mono">IST</span>
            </div>
            <div className="text-[8px] text-slate-400 font-mono tracking-wider uppercase leading-tight">
              {currentTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • INDORE GRID
            </div>
          </div>

          {/* Quick Access Global Module Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            
            {/* 🌐 Digital Twin 3D */}
            <button
              onClick={() => setShowDigitalTwin(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-[#142642] hover:bg-[#1a3459] border border-[#224574] text-cyan-300 transition-all shadow-sm"
              title="3D Digital Twin GIS Viewer"
            >
              <span>🌐</span>
              <span className="hidden lg:inline">Twin</span>
            </button>

            {/* 🧾 E-Challan MVA */}
            <button
              onClick={() => { setShowChallan(true); setChallanFile(null); setChallanResult(null); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-[#142642] hover:bg-[#1a3459] border border-[#224574] text-amber-300 transition-all shadow-sm"
              title="AI Challan Dispute Engine"
            >
              <span>🧾</span>
              <span className="hidden lg:inline">Challan</span>
            </button>

            {/* 📷 FaceTrace DeepFace */}
            <button
              onClick={() => setShowFaceTrace(!showFaceTrace)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border transition-all shadow-sm ${
                showFaceTrace ? 'bg-purple-600 text-white border-purple-400' : 'bg-[#142642] hover:bg-[#1a3459] border-[#224574] text-purple-300'
              }`}
              title="FaceTrace Missing Person Search"
            >
              <span>📷</span>
              <span className="hidden lg:inline">FaceTrace</span>
            </button>

            {/* 🏆 NagarScore Leaderboard */}
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border transition-all shadow-sm ${
                showLeaderboard ? 'bg-amber-600 text-white border-amber-400' : 'bg-[#142642] hover:bg-[#1a3459] border-[#224574] text-amber-300'
              }`}
              title="NagarScore Citizen Leaderboard"
            >
              <span>🏆</span>
              <span className="hidden lg:inline">Score</span>
            </button>

            {/* 💧 Jal Shakti IoT */}
            <button
              onClick={toggleJalShakti}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border transition-all shadow-sm ${
                showJalShakti ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-[#142642] hover:bg-[#1a3459] border-[#224574] text-cyan-300'
              }`}
              title="Jal Shakti Water Monitoring"
            >
              <span>💧</span>
              <span className="hidden lg:inline">Water</span>
              {waterAlerts.length > 0 && (
                <span className="px-1 py-0.2 rounded bg-red-600 text-white text-[8px] font-black">{waterAlerts.length}</span>
              )}
            </button>

            {/* 🚨 NagarSankat Geofence */}
            <button
              onClick={() => {
                setShowGeofence(!showGeofence);
                if (showGeofence) {
                  setGeofencePoints([]);
                  setGeofenceMessage('');
                }
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border transition-all shadow-sm ${
                showGeofence ? 'bg-red-600 text-white border-red-400 animate-pulse' : 'bg-[#142642] hover:bg-[#1a3459] border-[#224574] text-red-300'
              }`}
              title="NagarSankat Geofenced Emergency Alert"
            >
              <span>🚨</span>
              <span className="hidden lg:inline">Alert</span>
            </button>

            {/* 🤖 ARIA AI Co-Pilot */}
            <button
              onClick={() => setShowAria(!showAria)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border transition-all shadow-sm ${
                showAria ? 'bg-sky-500 text-slate-950 font-black border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]' : 'bg-gradient-to-r from-sky-600 to-blue-700 text-white border-sky-400/50 hover:from-sky-500 hover:to-blue-600'
              }`}
              title="ARIA AI Co-Pilot"
            >
              <span>🤖</span>
              <span>ARIA</span>
            </button>

          </div>
        </div>
      </header>

      {/* 🗺️ MAIN WORKSPACE: SIDEBAR + GIS MAP */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* 📋 LEFT SIDEBAR: INCIDENT DISPATCH FEED (TACTICAL CONSOLE) */}
        <aside className="w-[430px] flex flex-col bg-[#0b172a] border-r border-[#1b2f4a] z-10 shrink-0 shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
          
          {/* Sidebar Top Header */}
          <div className="p-4 bg-gradient-to-b from-[#0f1f38] to-[#0b172a] border-b border-[#1b2f4a]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase text-white font-rajdhani">
                  Incident Dispatch Feed <span className="text-slate-400 text-xs font-normal font-sans">(नियंत्रण कक्ष)</span>
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#142642] text-slate-300 border border-[#224574]">
                Total: {filteredIncidents.length}
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by FIR ID, ward, or incident type..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#07111e] border border-[#1b2f4a] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all font-mono"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs">✕</button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#07111e] rounded-lg border border-[#1b2f4a] text-[10px] font-bold uppercase tracking-wider text-center">
              {[
                { id: 'all', label: 'All', count: incidents.length },
                { id: 'active', label: 'Active', count: incidents.filter(i=>i.status==='active').length, color: 'text-red-400' },
                { id: 'dispatched', label: 'En-Route', count: incidents.filter(i=>i.status==='dispatched').length, color: 'text-sky-400' },
                { id: 'resolved', label: 'Resolved', count: incidents.filter(i=>i.status==='resolved').length, color: 'text-emerald-400' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setIncidentFilter(tab.id)}
                  className={`py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
                    incidentFilter === tab.id
                      ? 'bg-[#1b2f4a] text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`font-mono text-[9px] ${tab.color || 'text-slate-300'}`}>({tab.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Incident Feed List (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">

            {/* Sub-Panel: Parivahan ANPR Live Feed (when toggled) */}
            {showViolationsPanel && (
              <div className="bg-[#0e1d35] border border-amber-500/30 rounded-xl p-3.5 shadow-md">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-amber-400 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 font-rajdhani">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Parivahan ANPR • Live Camera Feed
                  </h3>
                  <span className="bg-amber-500/20 text-amber-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-amber-500/30">
                    EasyOCR Grid
                  </span>
                </div>
                {violations.length === 0 ? (
                  <p className="text-slate-500 text-[11px] text-center py-3">Scanning city camera feeds...</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {violations.slice(0, 10).map((v, i) => (
                      <div key={v.id || i} className={`rounded-lg p-2.5 border text-xs ${
                        v.is_stolen
                          ? 'bg-red-950/40 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                          : 'bg-[#07111e]/70 border-[#1b2f4a]'
                      }`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`font-mono font-bold tracking-wider ${v.is_stolen ? 'text-red-300' : 'text-amber-300'}`}>
                            {v.plate_detected}
                          </span>
                          {v.is_stolen ? (
                            <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black animate-pulse">🚨 STOLEN VEHICLE</span>
                          ) : (
                            <span className="text-slate-400 text-[9px] font-mono">{v.camera_id}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className={v.violation_type === 'STOLEN VEHICLE ALERT' ? 'text-red-400 font-bold' : 'text-slate-300'}>
                            {v.violation_type}
                          </span>
                          <span>{Math.round((v.confidence || 0) * 100)}% match</span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1 truncate">{v.camera_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-Panel: FloodWatch IoT Sensors (when toggled) */}
            {showFlood && floodSensors.length > 0 && (
              <div className="bg-[#0e1d35] border border-blue-400/30 rounded-xl p-3.5 shadow-md">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-blue-300 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 font-rajdhani">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    FloodWatch IoT Sensor Network
                  </h3>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                    floodSummary?.critical > 0 ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}>
                    {floodSummary?.critical > 0 ? '🚨 FLOOD RISK' : 'NORMAL'}
                  </span>
                </div>
                <div className="space-y-2">
                  {floodSensors.map(s => {
                    const pct = Math.min(100, (s.current_level_m / (s.danger_level_m * 1.2)) * 100);
                    return (
                      <div key={s.id} className={`rounded-lg p-2.5 border text-xs ${
                        s.alert_status === 'CRITICAL' ? 'bg-red-950/40 border-red-500/40' :
                        s.alert_status === 'WARNING' ? 'bg-amber-950/40 border-amber-500/30' :
                        'bg-[#07111e]/70 border-[#1b2f4a]'
                      }`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-white truncate">{s.name}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            s.alert_status === 'CRITICAL' ? 'bg-red-500 text-white animate-pulse' :
                            s.alert_status === 'WARNING' ? 'bg-amber-500 text-black' : 'bg-blue-500/20 text-blue-300'
                          }`}>{s.alert_status}</span>
                        </div>
                        <div className="h-1.5 bg-[#07111e] rounded-full overflow-hidden my-1.5 border border-[#1b2f4a]">
                          <div
                            className={`h-full rounded-full ${s.alert_status === 'CRITICAL' ? 'bg-red-500' : s.alert_status === 'WARNING' ? 'bg-amber-400' : 'bg-blue-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Level: <b className="text-white">{s.current_level_m}m</b> / {s.danger_level_m}m</span>
                          <span>🌧️ {s.rainfall_mm_hr}mm/h</span>
                          <span>{s.trend}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sub-Panel: MedETA Hospital Bed Occupancy (when toggled) */}
            {showMedETA && hospitals.length > 0 && (
              <div className="bg-[#0e1d35] border border-emerald-500/30 rounded-xl p-3.5 shadow-md">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-emerald-300 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 font-rajdhani">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    MedETA • Hospital Bed Capacity
                  </h3>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-emerald-500/30">
                    Ayushman Grid
                  </span>
                </div>
                <div className="space-y-2">
                  {hospitals.map(h => (
                    <div
                      key={h.id}
                      onClick={() => setSelectedHospital(selectedHospital?.id === h.id ? null : h)}
                      className={`rounded-lg p-2.5 border text-xs cursor-pointer transition-all ${
                        h.status === 'AVAILABLE' ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400' :
                        h.status === 'BUSY' ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400' :
                        'bg-red-950/20 border-red-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white">{h.short}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          h.status === 'AVAILABLE' ? 'bg-emerald-500/30 text-emerald-300' :
                          h.status === 'BUSY' ? 'bg-amber-500/30 text-amber-300' :
                          'bg-red-500/30 text-red-300'
                        }`}>{h.status}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-300">
                        <span>Emerg: <b className="text-emerald-400">{h.available_emergency}</b></span>
                        <span>ICU: <b className="text-blue-400">{h.available_icu}</b></span>
                        <span>{h.occupancy_pct}% full</span>
                      </div>
                      {selectedHospital?.id === h.id && (
                        <div className="mt-2 pt-2 border-t border-[#1b2f4a] text-[10px] text-slate-400 space-y-0.5">
                          <p>📞 {h.phone}</p>
                          <p className="text-sky-300">{h.specialties.join(' • ')}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {medRoute && (
                  <div className="mt-3 p-3 rounded-lg bg-[#07111e] border border-emerald-500/40 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Active MedETA Fast-Path</span>
                      <button onClick={() => setMedRoute(null)} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                    </div>
                    <p className="text-white font-bold">{medRoute.recommended_hospital.name}</p>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                      <span>ETA: <b className="text-emerald-400">{medRoute.eta_minutes} min</b></span>
                      <span>Dist: {medRoute.distance_km} km</span>
                      <span>Beds: {medRoute.recommended_hospital.available_emergency}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Panel: Traffic Prediction LSTM (when toggled) */}
            {showTraffic && (
              <div className="bg-[#0e1d35] border border-sky-400/30 rounded-xl p-3.5 shadow-md">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-sky-300 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 font-rajdhani">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    Traffic Congestion Forecast (+30m)
                  </h3>
                  <span className="bg-sky-500/20 text-sky-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-sky-500/30">
                    LSTM Model
                  </span>
                </div>
                <div className="space-y-2">
                  {trafficData.map(node => (
                    <div key={node.node_id} className="text-xs bg-[#07111e]/70 p-2 rounded-lg border border-[#1b2f4a]">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-200 font-semibold">{node.name}</span>
                        <span className={node.trend === 'increasing' ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {node.predicted_volume}% {node.trend === 'increasing' ? '↑' : '↓'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#07111e] rounded-full overflow-hidden flex border border-[#1b2f4a]">
                        <div className="bg-sky-500 h-full opacity-40" style={{ width: `${node.current_volume}%` }} />
                        <div
                          className={`h-full ${node.predicted_volume > 80 ? 'bg-red-500' : node.predicted_volume > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(0, node.predicted_volume - node.current_volume)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Panel: VidyaTrack School Feed (when toggled) */}
            {showVidyaPanel && vidyaSchools.length > 0 && (
              <div className="bg-[#0e1d35] border border-sky-400/30 rounded-xl p-3.5 shadow-md">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-sky-300 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 font-rajdhani">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    VidyaTrack • School Operations & RFID
                  </h3>
                  <span className="bg-sky-500/20 text-sky-300 text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-sky-500/30">
                    Live IoT
                  </span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {vidyaSchools.map(s => (
                    <div key={s.id} className="rounded-lg p-2.5 border border-[#1b2f4a] bg-[#07111e]/70 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white truncate max-w-[190px]">{s.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          s.attendance_rate >= 80 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>{s.attendance_rate}% Present</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>👥 {s.active_students}/{s.total_enrolled} enrolled</span>
                        <span className={s.meal_status === 'SERVED' ? 'text-emerald-400' : 'text-amber-400'}>
                          🍲 {s.meal_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Incident Feed List */}
            {filteredIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 mt-6 border border-dashed border-[#1b2f4a] rounded-xl bg-[#07111e]/40">
                <Shield className="w-10 h-10 mb-2 opacity-30 text-emerald-500" />
                <p className="text-xs uppercase tracking-widest font-bold text-slate-400">All Sectors Clear</p>
                <p className="text-[10px] mt-1 text-slate-500">No active incidents matching the current filter</p>
              </div>
            ) : (
              filteredIncidents.map(incident => {
                const isResolved = incident.status === 'resolved';
                const isDispatched = incident.status === 'dispatched';
                const isTraffic = incident.incident_type === 'Traffic Violation';

                return (
                  <div
                    key={incident.id}
                    className={`rounded-xl border p-4 transition-all duration-200 relative overflow-hidden group ${
                      isResolved
                        ? 'bg-[#091424]/80 border-emerald-500/20 opacity-75'
                        : isDispatched
                        ? 'bg-[#0d1b32] border-sky-500/40 shadow-[0_0_15px_rgba(56,189,248,0.1)]'
                        : isTraffic
                        ? 'bg-[#0e1c33] border-amber-500/30 hover:border-amber-500/60'
                        : 'bg-[#101c36] border-red-500/40 hover:border-red-500/70 shadow-sm'
                    }`}
                  >
                    {/* Header: Type Badge & Reference ID */}
                    <div className="flex justify-between items-start mb-2.5">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 border ${
                        isResolved
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                          : isTraffic
                          ? 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                          : 'bg-red-950/70 text-red-300 border-red-500/50 animate-pulse'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {incident.incident_type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold bg-[#07111e] px-2 py-0.5 rounded border border-[#1b2f4a]">
                        REF: {incident.id}
                      </span>
                    </div>

                    {/* Location & Time */}
                    <div className="space-y-1.5 text-xs text-slate-300 mb-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <span className="font-medium text-slate-200 leading-snug">{incident.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pl-5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{new Date(incident.timestamp).toLocaleTimeString('en-IN', { hour12: false })} IST</span>
                      </div>
                    </div>

                    {/* Description Quote */}
                    {incident.description && (
                      <div className="bg-[#07111e]/90 p-2.5 rounded-lg border border-[#1b2f4a] text-xs text-slate-300 mb-3 italic">
                        "{incident.description}"
                      </div>
                    )}

                    {/* Evidence Photo Preview */}
                    {incident.image_data && (
                      <div className="mb-3 relative rounded-lg overflow-hidden border border-[#1b2f4a] group/img cursor-pointer" onClick={() => setPreviewPhoto(incident.image_data)}>
                        <img
                          src={incident.image_data}
                          alt="Evidence Capture"
                          className="w-full h-36 object-cover transition-transform group-hover/img:scale-105 duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <span className="bg-slate-900/90 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                            <Maximize2 className="w-3 h-3" /> Click to Expand Evidence
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Dispatch Action Panel */}
                    <div className="pt-2 border-t border-[#1b2f4a] flex flex-col gap-2">
                      
                      {/* Active State -> Init Dispatch */}
                      {incident.status === 'active' && (
                        <button
                          onClick={() => handleDispatch(incident)}
                          className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white text-xs font-black tracking-wider py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md uppercase"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Init Adaptive Dispatch
                        </button>
                      )}

                      {/* Dispatched State -> Show Unit En Route */}
                      {isDispatched && (
                        <div className="bg-[#07111e] p-3 rounded-lg border border-sky-500/40 relative">
                          <div className="flex items-center gap-2 text-sky-400 text-xs font-black uppercase tracking-wider mb-1">
                            <Navigation className="w-3.5 h-3.5 animate-pulse" />
                            Unit En Route: {incident.assigned_unit}
                          </div>
                          {activeRoutes[incident.id] && (
                            <div className="flex justify-between items-center text-[11px] text-slate-300 font-mono mt-1 pt-1 border-t border-[#1b2f4a]">
                              <span>ETA: <b className="text-sky-300 text-sm">{activeRoutes[incident.id].eta}m</b></span>
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-black uppercase">
                                Fastest Corridor
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* MedETA Route (when Hospital Layer active) */}
                      {!isResolved && showMedETA && (
                        <button
                          onClick={() => triggerMedRoute(incident)}
                          disabled={medRouteLoading}
                          className="w-full bg-emerald-600/15 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-wider py-2 rounded-lg transition-all uppercase flex items-center justify-center gap-1.5"
                        >
                          <span>🏥</span>
                          <span>{medRoute?.incidentId === incident.id ? `Route Active (${medRoute.eta_minutes}m)` : (medRouteLoading ? 'Calculating route...' : 'MedETA Hospital Corridor')}</span>
                        </button>
                      )}

                      {/* Nagrik-Drishti Live Feed Button */}
                      {!isResolved && (
                        <button
                          onClick={() => openDrishti(incident.id)}
                          className="w-full bg-red-600/15 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-[10px] font-bold tracking-wider py-2 rounded-lg transition-all uppercase flex items-center justify-center gap-2"
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          Nagrik-Drishti CCTV Stream
                        </button>
                      )}

                      {/* Mark Resolved Button */}
                      {!isResolved ? (
                        <button
                          onClick={() => updateStatus(incident.id, 'resolved')}
                          className="w-full bg-[#142642] hover:bg-emerald-950 hover:border-emerald-500/60 hover:text-emerald-300 border border-[#224574] text-slate-300 text-[10px] font-bold tracking-wider py-2 rounded-lg transition-all uppercase flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Mark Case Resolved
                        </button>
                      ) : (
                        <div className="w-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-black tracking-widest py-2 rounded-lg flex items-center justify-center gap-1.5 uppercase">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Case Closed & Verified
                        </div>
                      )}

                    </div>
                  </div>
                );
              })
            )}

          </div>

        </aside>

        {/* 🗺️ RIGHT SIDE: GIS MAP WORKSPACE WITH INTEGRATED COMMAND TOOLBAR */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          
          {/* 🎛️ SMART CITY GIS LAYER TOOLBAR (DOCKED AT TOP OF MAP) */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-wrap gap-2 max-w-[calc(100%-120px)] pointer-events-auto">
            <div className="bg-[#0b172a]/95 backdrop-blur-md border border-[#1b2f4a] p-1.5 rounded-xl shadow-xl flex flex-wrap items-center gap-1 text-[11px]">
              
              <span className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-r border-[#1b2f4a] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-sky-400" /> Layers
              </span>

              {/* Environment Group */}
              <button
                onClick={toggleAQI}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showAQI ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="Vayu Air Quality Index"
              >
                <span>🌿</span> Vayu AQI
              </button>

              <button
                onClick={toggleHeatmap}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showHeatmap ? 'bg-orange-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="AI Random Forest Crime Hotspots"
              >
                <span>🔥</span> Hotspots
              </button>

              <button
                onClick={() => setShowHeat(!showHeat)}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showHeat ? 'bg-red-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="Heat Island Risk Engine"
              >
                <span>🌡️</span> Heat Index
                {showHeat && heatAlerts.length > 0 && (
                  <span className="bg-red-950 px-1 py-0.2 rounded text-[9px] font-black">{heatAlerts.length}</span>
                )}
              </button>

              {/* Mobility Group */}
              <span className="w-px h-4 bg-[#1b2f4a] mx-0.5"></span>

              <button
                onClick={toggleTraffic}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showTraffic ? 'bg-sky-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="Traffic Predictor"
              >
                <span>🚗</span> Nagar-Gati
              </button>

              <button
                onClick={toggleTransit}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showTransit ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="NagarYatra Smart Bus Transit"
              >
                <span>🚌</span> Transit
                {showTransit && liveBuses.length > 0 && (
                  <span className="bg-blue-950 px-1 py-0.2 rounded text-[9px] font-black">{liveBuses.length}</span>
                )}
              </button>

              <button
                onClick={toggleParivahan}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showParivahan ? 'bg-amber-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="Parivahan ANPR Speed & Stolen Vehicle Cameras"
              >
                <span>📹</span> Parivahan
                {showParivahan && violations.some(v => v.is_stolen) && (
                  <span className="bg-red-600 text-white px-1.5 py-0.2 rounded text-[9px] font-black animate-pulse">STOLEN</span>
                )}
              </button>

              {/* Civic & Safety Group */}
              <span className="w-px h-4 bg-[#1b2f4a] mx-0.5"></span>

              <button
                onClick={toggleCityHealth}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showGrievances ? 'bg-purple-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="Indore-311 Civic Grievances"
              >
                <span>🏗️</span> Indore-311
              </button>

              <button
                onClick={toggleMedETA}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showMedETA ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="MedETA Hospitals & Bed Availability"
              >
                <span>🏥</span> MedETA
                {showMedETA && hospitals.length > 0 && (
                  <span className="bg-emerald-950 px-1 py-0.2 rounded text-[9px] font-black">{hospitals.filter(h=>h.can_receive).length} OPEN</span>
                )}
              </button>

              <button
                onClick={toggleFlood}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showFlood ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="FloodWatch IoT Sensors"
              >
                <span>🌊</span> FloodWatch
                {showFlood && floodSummary && floodSummary.critical > 0 && (
                  <span className="bg-red-600 text-white px-1 py-0.2 rounded text-[9px] font-black animate-pulse">{floodSummary.critical} CRIT</span>
                )}
              </button>

              <button
                onClick={toggleVidya}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showVidya ? 'bg-sky-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="VidyaTrack Government Schools"
              >
                <span>🎓</span> VidyaTrack
              </button>

              <button
                onClick={() => setShowVolunteers(!showVolunteers)}
                className={`px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                  showVolunteers ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#142642]/60 hover:bg-[#1b3459] text-slate-300'
                }`}
                title="NagarSeva Verified Citizen Responders"
              >
                <span>🌍</span> Volunteers
                {volunteers.length > 0 && (
                  <span className="bg-blue-950 px-1 py-0.2 rounded text-[9px] font-black">{volunteers.length}</span>
                )}
              </button>

            </div>
          </div>

          {/* LEAFLET MAP CONTAINER */}
          <div className="flex-1 w-full h-full relative z-0">
            <MapContainer
              center={[22.7196, 75.8577]} // Indore Municipal Centre
              zoom={12}
              className="w-full h-full"
              zoomControl={false}
              scrollWheelZoom={true}
              doubleClickZoom={true}
              dragging={true}
              touchZoom={true}
            >
              <ZoomControl position="topright" />

              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> • Govt of Madhya Pradesh'
                className="dark-tiles"
              />

              {/* NAGARSANKAT GEOFENCE DRAWING LAYER */}
              <GeofenceDrawer active={showGeofence} points={geofencePoints} setPoints={setGeofencePoints} />

              {/* AMBULANCE & DISPATCH UNITS LAYER */}
              {units.map((unit) => (
                <Marker
                  key={unit.id}
                  position={[unit.lat, unit.lng]}
                  icon={ambulanceIcon}
                >
                  <Popup>
                    <div className="p-1 min-w-[160px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-blue-600/30 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Dispatch Unit</span>
                        <span className="text-slate-400 text-[9px] font-mono">{unit.id}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm">{unit.name}</h4>
                      <p className="text-slate-300 text-xs mt-1">Status: <b className="text-sky-300 uppercase">{unit.status}</b></p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* NAGARSEVA VOLUNTEERS LAYER */}
              {showVolunteers && volunteers.map((vol) => (
                <Marker
                  key={vol.id}
                  position={[vol.lat, vol.lng]}
                  icon={volunteerIcon}
                >
                  <Popup>
                    <div className="p-1 min-w-[160px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-blue-600/30 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase">NagarSeva Responder</span>
                        <span className="text-slate-400 text-[9px] font-mono">{vol.id}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm">{vol.name}</h4>
                      <p className="text-slate-300 text-xs mt-1">Status: <b className="text-emerald-400 uppercase">{vol.status}</b></p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {vol.skills?.map((skill, i) => (
                          <span key={i} className="text-[9px] bg-blue-900/60 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold uppercase">{skill}</span>
                        ))}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* ADAPTIVE FAST-PATH ROUTES */}
              {Object.entries(activeRoutes).map(([incidentId, route]) => (
                <Polyline
                  key={`route-${incidentId}`}
                  positions={route.polyline}
                  pathOptions={{
                    color: '#38bdf8',
                    weight: 5,
                    opacity: 0.85,
                    dashArray: '10, 8',
                    lineJoin: 'round'
                  }}
                />
              ))}

              {/* AI HOTSPOTS LAYER */}
              {showHeatmap && heatmapData.map((node) => (
                <CircleMarker
                  key={node.id}
                  center={[node.lat, node.lng]}
                  radius={node.weight * 40}
                  pathOptions={{
                    fillColor: '#ef4444',
                    color: 'transparent',
                    fillOpacity: 0.25,
                  }}
                >
                  <Tooltip sticky className="bg-slate-900 border border-slate-700 text-white text-[10px] p-2 rounded shadow-xl">
                    <span className="font-bold text-red-400">🔥 High Priority Hotspot</span><br/>
                    AI Probability: {(node.weight * 100).toFixed(1)}%
                  </Tooltip>
                </CircleMarker>
              ))}

              {/* TRAFFIC CONGESTION FORECAST NODES */}
              {showTraffic && trafficData.map((node) => (
                <CircleMarker
                  key={`traffic-${node.node_id}`}
                  center={[node.lat, node.lng]}
                  radius={node.predicted_volume / 2.5}
                  pathOptions={{
                    fillColor: node.predicted_volume > 80 ? '#ef4444' : node.predicted_volume > 50 ? '#f97316' : '#10b981',
                    color: node.predicted_volume > 80 ? '#ef4444' : 'transparent',
                    fillOpacity: 0.35,
                    weight: 2,
                    dashArray: '5, 5'
                  }}
                >
                  <Tooltip permanent direction="top" className="bg-slate-900 border border-slate-700 text-white text-[10px] p-1 rounded">
                    {node.name}: {node.predicted_volume}%
                  </Tooltip>
                </CircleMarker>
              ))}

              {/* VIDYATRACK SCHOOL MARKERS */}
              {showVidya && vidyaSchools.map((school) => (
                <Marker
                  key={school.id}
                  position={[school.lat, school.lng]}
                  icon={schoolIcon}
                >
                  <Popup>
                    <div className="p-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-sky-500/20 text-sky-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Govt School</span>
                        <span className="text-slate-400 text-[9px] font-mono">{school.id}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1">{school.name}</h4>
                      <p className="text-slate-400 text-[11px] mb-2">{school.type}</p>
                      
                      <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                        <div className="bg-[#07111e] rounded p-1.5 text-center border border-[#1b2f4a]">
                          <p className="font-black text-sm text-sky-400">{school.active_students}</p>
                          <p className="text-slate-500 text-[8px] uppercase">Students Active</p>
                        </div>
                        <div className="bg-[#07111e] rounded p-1.5 text-center border border-[#1b2f4a]">
                          <p className="font-black text-sm text-emerald-400">{school.attendance_rate}%</p>
                          <p className="text-slate-500 text-[8px] uppercase">Attendance</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-[10px] text-slate-300">
                        <p>🧑‍🏫 <b>Principal:</b> {school.principal}</p>
                        <p>📞 <b>Phone:</b> {school.contact}</p>
                        <p>🍲 <b>Mid-day Meal:</b> <span className={school.meal_status === 'SERVED' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{school.meal_status}</span></p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* PARIVAHAN CCTV CAMERAS */}
              {showParivahan && cctvCameras.map((cam) => {
                const recentViolation = violations.find(v => v.camera_id === cam.id);
                return (
                  <Marker
                    key={cam.id}
                    position={[cam.lat, cam.lng]}
                    icon={recentViolation?.is_stolen ? cctvAlertIcon : cctvIcon}
                  >
                    <Popup>
                      <div className="p-1 min-w-[180px]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Parivahan ANPR</span>
                          <span className="text-slate-400 text-[10px] font-mono">{cam.id}</span>
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">{cam.name}</h4>
                        <p className="text-slate-400 text-xs mb-2">Zone: {cam.zone}</p>
                        {recentViolation ? (
                          <div className={`p-2 rounded-lg text-xs border ${
                            recentViolation.is_stolen
                              ? 'bg-red-950/50 border-red-500/40 text-red-300'
                              : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                          }`}>
                            <p className="font-black">{recentViolation.is_stolen ? '🚨 STOLEN VEHICLE ALERT' : recentViolation.violation_type}</p>
                            <p className="font-mono mt-0.5 font-bold">{recentViolation.plate_detected}</p>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-[10px]">Camera status normal • 0 flags</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* INDORE-311 GRIEVANCES */}
              {showGrievances && grievances.map((g) => (
                <Marker key={`g-${g.id}`} position={[g.lat, g.lng]} icon={grievanceIcon}>
                  <Popup>
                    <div className="p-1 min-w-[180px]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-purple-600/30 text-purple-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Indore-311 Citizen</span>
                        <span className="text-slate-400 text-[10px] font-mono">{g.id}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1">{g.category}</h4>
                      <p className="text-slate-300 text-xs mb-2 leading-snug">{g.description}</p>
                      <div className="flex items-center gap-2 text-xs border-t border-[#1b2f4a] pt-1 mt-1">
                        <span className={`font-bold ${g.priority >= 4 ? 'text-red-400' : 'text-emerald-400'}`}>Priority: Level {g.priority}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300 capitalize">{g.status}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* MEDETA HOSPITALS */}
              {showMedETA && hospitals.map(h => (
                <Marker
                  key={h.id}
                  position={[h.lat, h.lng]}
                  icon={hospitalIcon(h.status)}
                >
                  <Popup>
                    <div className="p-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          h.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300' :
                          h.status === 'BUSY' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
                        }`}>{h.status}</span>
                        <span className="text-slate-400 text-[10px]">{h.type}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-2">{h.name}</h4>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2">
                        <div className="bg-[#07111e] rounded p-1.5 text-center border border-[#1b2f4a]">
                          <p className={`font-black text-base ${h.available_emergency > 3 ? 'text-emerald-400' : h.available_emergency > 0 ? 'text-amber-400' : 'text-red-400'}`}>{h.available_emergency}</p>
                          <p className="text-slate-500 text-[8px] uppercase">Emergency Beds</p>
                        </div>
                        <div className="bg-[#07111e] rounded p-1.5 text-center border border-[#1b2f4a]">
                          <p className={`font-black text-base ${h.available_icu > 0 ? 'text-blue-400' : 'text-red-400'}`}>{h.available_icu}</p>
                          <p className="text-slate-500 text-[8px] uppercase">ICU Beds</p>
                        </div>
                      </div>
                      <p className="text-slate-300 text-[10px]">📞 {h.phone}</p>
                      <p className="text-sky-300 text-[10px] mt-1">{h.specialties?.join(' • ')}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* MEDETA SMART ROUTE POLYLINE */}
              {showMedETA && medRoute?.polyline && (
                <Polyline
                  positions={medRoute.polyline}
                  pathOptions={{
                    color: '#10b981',
                    weight: 6,
                    opacity: 0.9,
                    dashArray: '8, 6',
                  }}
                />
              )}

              {/* FLOODWATCH SENSORS */}
              {showFlood && floodSensors.map(s => (
                <CircleMarker
                  key={`flood-${s.id}`}
                  center={[s.lat, s.lng]}
                  radius={s.alert_status === 'CRITICAL' ? 26 : s.alert_status === 'WARNING' ? 20 : 14}
                  pathOptions={{
                    fillColor: s.alert_status === 'CRITICAL' ? '#ef4444' : s.alert_status === 'WARNING' ? '#f59e0b' : '#38bdf8',
                    color: s.alert_status === 'CRITICAL' ? '#ef4444' : s.alert_status === 'WARNING' ? '#f59e0b' : '#38bdf8',
                    fillOpacity: s.alert_status === 'CRITICAL' ? 0.35 : 0.2,
                    weight: 2,
                  }}
                >
                  <Tooltip permanent direction="top" className="bg-slate-900 border border-slate-700 text-white text-[10px] p-1.5 rounded shadow-xl">
                    <span className={`font-black ${s.alert_status === 'CRITICAL' ? 'text-red-400' : s.alert_status === 'WARNING' ? 'text-amber-400' : 'text-sky-300'}`}>
                      🌊 {s.id}
                    </span>
                    <br />{s.current_level_m}m / {s.danger_level_m}m
                  </Tooltip>
                  <Popup>
                    <div className="p-1 min-w-[180px]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          s.alert_status === 'CRITICAL' ? 'bg-red-500/20 text-red-300' :
                          s.alert_status === 'WARNING' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                        }`}>{s.alert_status}</span>
                        <span className="text-slate-400 text-[9px] font-mono">{s.id}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-2">{s.name}</h4>
                      <p className="text-slate-300 text-xs">Level: <b className="text-white">{s.current_level_m}m</b> (Danger: {s.danger_level_m}m)</p>
                      <p className="text-slate-400 text-[10px] mt-1">🌧️ Rainfall: {s.rainfall_mm_hr} mm/hr</p>
                      <p className="text-slate-400 text-[10px]">📈 Trend: {s.trend}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* HEAT ISLAND ENGINE LAYER */}
              {showHeat && (
                <HeatmapLayer
                  points={heatZones.map((z) => [
                    z.lat,
                    z.lng,
                    z.perceived_temp_c / 85.0
                  ])}
                />
              )}
              {showHeat && heatZones.map((zone) => (
                <Marker
                  key={zone.id}
                  position={[zone.lat, zone.lng]}
                  icon={heatZoneIcon(zone.risk_level)}
                >
                  <Popup>
                    <div className="p-1 min-w-[180px]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          zone.risk_level === 'CRITICAL' ? 'bg-red-500/20 text-red-300' :
                          zone.risk_level === 'HIGH' ? 'bg-orange-500/20 text-orange-300' : 'bg-yellow-500/20 text-yellow-300'
                        }`}>{zone.risk_level} RISK</span>
                        <span className="text-slate-400 text-[9px] font-mono">{zone.id}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1">{zone.name}</h4>
                      <p className="text-slate-300 text-xs">Perceived Temp: <b className="text-orange-400">{zone.perceived_temp_c}°C</b></p>
                      <p className="text-slate-400 text-[10px] mt-1">Actual: {zone.current_temp_c}°C • Humidity: {zone.humidity_pct}%</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* NAGARYATRA BUS STOPS */}
              {showTransit && busStops.map((stop) => (
                <CircleMarker
                  key={stop.id}
                  center={[stop.lat, stop.lng]}
                  radius={5}
                  pathOptions={{ fillColor: stop.route_color, color: '#fff', fillOpacity: 0.9, weight: 1.5 }}
                >
                  <Tooltip sticky className="bg-slate-900 border border-slate-700 text-white text-[10px] p-1.5 rounded shadow-xl">
                    <span className="font-bold" style={{color: stop.route_color}}>🚏 {stop.name}</span><br/>
                    <span className="text-slate-400">{stop.route_name}</span>
                  </Tooltip>
                </CircleMarker>
              ))}

              {/* NAGARYATRA LIVE BUSES */}
              {showTransit && liveBuses.map((bus) => {
                const busIcon = L.divIcon({
                  html: `<div style="background:${bus.route_color};width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 12px ${bus.route_color}88;border:2px solid white;">🚌</div>`,
                  className: '',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                });
                return (
                  <Marker key={bus.id} position={[bus.lat, bus.lng]} icon={busIcon}>
                    <Popup>
                      <div className="p-1 min-w-[190px]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-300">LIVE BUS</span>
                          <span className="text-slate-400 text-[9px] font-mono">{bus.id}</span>
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">{bus.route_name}</h4>
                        <p className="text-slate-300 text-xs">Next: <b>{bus.next_stop_name}</b> (~{bus.eta_minutes}m)</p>
                        <p className="text-slate-400 text-[10px] mt-1">Occupancy: {bus.occupancy}/{bus.capacity} ({bus.occupancy_pct}%) • Speed: {bus.speed_kmh} km/h</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* INCIDENTS MAP MARKERS */}
              {incidents.map((incident) => (
                <Marker
                  key={incident.id}
                  position={[incident.lat, incident.lng]}
                  icon={incident.incident_type === 'Traffic Violation' ? pulsingYellowIcon : pulsingRedIcon}
                >
                  <Popup>
                    <div className="p-1 min-w-[180px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          incident.incident_type === 'Traffic Violation' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
                        }`}>{incident.incident_type}</span>
                        <span className="text-slate-400 text-[9px] font-mono">{incident.id}</span>
                      </div>
                      <h4 className="text-white font-bold text-sm mb-1">{incident.address}</h4>
                      <p className="text-slate-400 text-[10px] mb-2">{new Date(incident.timestamp).toLocaleTimeString('en-IN', { hour12: false })} IST</p>
                      {incident.status === 'active' && (
                        <button
                          onClick={() => handleDispatch(incident)}
                          className="w-full bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold py-1.5 rounded uppercase"
                        >
                          Dispatch Unit
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

            </MapContainer>
          </div>

          {/* 🧭 OFFICIAL GIS MAP HUD: COORDINATES & STATUS BAR */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-[#0b172a]/90 backdrop-blur-md border border-[#1b2f4a] px-3.5 py-1.5 rounded-lg shadow-lg text-[10px] font-mono text-slate-400 flex items-center gap-3 pointer-events-auto">
            <span className="text-sky-400 font-bold flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> 22.7196° N, 75.8577° E
            </span>
            <span className="text-slate-600">|</span>
            <span>INDORE MUNICIPAL GRID (IMC ZONE 1-19)</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">WGS 84 • EPSG:4326</span>
          </div>

          {/* 🗺️ OFFICIAL GIS MAP LEGEND (BOTTOM RIGHT) */}
          <div className="absolute bottom-3 right-3 z-[1000] bg-[#0b172a]/95 backdrop-blur-md border border-[#1b2f4a] p-2.5 rounded-xl shadow-xl text-[10px] text-slate-300 space-y-1 pointer-events-auto max-w-xs">
            <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px] border-b border-[#1b2f4a] pb-1 mb-1">
              GIS Legend (मानचित्र संकेत)
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white"></span>
                <span>P1 Incident (SOS)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white"></span>
                <span>Traffic Flag</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🚑</span>
                <span>En-Route Units</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🏥</span>
                <span>MedETA Beds</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">📹</span>
                <span>Parivahan CCTV</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🌊</span>
                <span>Flood Sensors</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🚌</span>
                <span>Transit Buses</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🎓</span>
                <span>Vidya Schools</span>
              </div>
            </div>
          </div>

        </main>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          OFFICIAL OVERLAYS, DRAWERS & MODALS
      ───────────────────────────────────────────────────────────── */}

      {/* 1. 🚨 NAGARSANKAT GEOFENCE BROADCAST PANEL */}
      {showGeofence && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#0c182b]/95 backdrop-blur-xl border-2 border-red-500/60 rounded-2xl p-5 w-[460px] z-[2000] shadow-[0_0_50px_rgba(239,68,68,0.4)]">
          <div className="flex justify-between items-center mb-3 border-b border-red-500/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl animate-pulse">🚨</span>
              <div>
                <h3 className="text-red-400 font-black text-sm tracking-wider uppercase font-rajdhani">
                  NagarSankat • Geofenced Emergency Alert
                </h3>
                <p className="text-slate-400 text-[9px] uppercase">State Disaster Management Division (SDMD)</p>
              </div>
            </div>
            <button onClick={() => setShowGeofence(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
          </div>
          
          <div className="text-xs text-slate-300 mb-3 bg-[#07111e] p-3 rounded-lg border border-[#1b2f4a] space-y-1">
            <p><strong>1.</strong> Click points on the GIS map to enclose the target danger perimeter.</p>
            <p><strong>2.</strong> Right-click removes the last vertex point.</p>
            <p><strong>3.</strong> Enter the urgent Hindi/English emergency directive and broadcast.</p>
          </div>

          <div className="mb-3 flex justify-between items-center text-xs">
            <span className="text-slate-400">Perimeter Status:</span>
            <span className={`font-bold ${geofencePoints.length < 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {geofencePoints.length < 3 ? `Define at least ${3 - geofencePoints.length} more point(s)` : `Perimeter Locked (${geofencePoints.length} points)`}
            </span>
          </div>

          <textarea
            value={geofenceMessage}
            onChange={(e) => setGeofenceMessage(e.target.value)}
            placeholder="आपातकालीन सूचना: क्षेत्र में भारी जलभराव/दुर्घटना के कारण तत्काल सुरक्षित स्थान पर जाएं / URGENT: Evacuate zone immediately due to..."
            className="w-full h-24 bg-[#07111e] border border-red-500/40 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-red-500 mb-3"
          />

          <button
            onClick={broadcastGeofenceAlert}
            disabled={geofencePoints.length < 3 || !geofenceMessage.trim() || geofenceLoading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            {geofenceLoading ? 'Broadcasting via Telecom Towers...' : 'Broadcast Emergency Alert To Enclosed Zone'}
          </button>
        </div>
      )}

      {/* 2. 🏆 NAGARSCORE CITIZEN LEADERBOARD DRAWER */}
      <div className={`fixed top-0 left-0 h-screen w-[420px] bg-[#0a1526]/98 backdrop-blur-2xl border-r border-amber-500/30 z-[2500] transform transition-transform duration-500 ease-in-out shadow-[20px_0_60px_rgba(245,158,11,0.15)] flex flex-col ${showLeaderboard ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Drawer Header */}
        <div className="p-5 bg-gradient-to-b from-[#14233c] to-[#0a1526] border-b border-amber-500/20 shrink-0">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <div>
                <h2 className="text-base font-black text-white tracking-wider uppercase font-rajdhani">
                  NagarScore • Citizen Gamification Board
                </h2>
                <p className="text-amber-400 text-[10px] font-mono tracking-widest uppercase">Swachh Survekshan • Citizen Honor Roll</p>
              </div>
            </div>
            <button onClick={() => setShowLeaderboard(false)} className="w-8 h-8 rounded-lg bg-[#142642] flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</button>
          </div>

          {leaderboardData[0] && (
            <div className="mt-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-xl font-black text-white shadow-md">1</div>
              <div>
                <p className="text-slate-400 text-[9px] uppercase tracking-widest font-bold">Current Top Citizen</p>
                <p className="text-white font-bold text-sm">{leaderboardData[0]?.name}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-amber-400 font-black text-sm">{leaderboardData[0]?.score} XP</p>
                <span className="text-[9px] text-slate-400">Rank #1</span>
              </div>
            </div>
          )}
        </div>

        {/* Citizens List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {leaderboardData.map((citizen, index) => (
            <div key={citizen.id} className="bg-[#0e1d35] border border-[#1b2f4a] hover:border-amber-500/40 rounded-xl p-3.5 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#07111e] border border-[#1b2f4a] flex items-center justify-center text-2xl shrink-0">
                  {citizen.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-bold text-white text-sm truncate">{citizen.name}</h3>
                    <span className="text-amber-400 font-black text-xs">{citizen.score} XP</span>
                  </div>
                  <div className="flex justify-between items-center mb-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                      citizen.tier === 'Platinum' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                      citizen.tier === 'Gold' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      citizen.tier === 'Silver' ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                      'bg-orange-800/30 text-orange-400 border border-orange-800/50'
                    }`}>{citizen.tier} Tier</span>
                    <span className="text-slate-500 font-mono">Rank #{index + 1}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {citizen.badges.map((badge, i) => (
                      <span key={i} className="text-[9px] bg-[#07111e] text-slate-300 border border-[#1b2f4a] px-1.5 py-0.5 rounded font-medium">
                        🎖️ {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#1b2f4a] text-center text-[10px] text-slate-500">
          NagarScore Governance • Municipal Recognition Portal
        </div>
      </div>

      {/* 3. 💧 JAL SHAKTI WATER MONITORING DRAWER */}
      {showJalShakti && (
        <div className="fixed right-0 top-0 h-full w-[440px] z-[2500] bg-[#0a1526]/98 border-l border-cyan-500/30 backdrop-blur-2xl flex flex-col shadow-[-20px_0_60px_rgba(6,182,212,0.15)]">
          {/* Header */}
          <div className="p-5 bg-gradient-to-b from-[#14233c] to-[#0a1526] border-b border-cyan-500/20 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">💧</span>
                <div>
                  <h2 className="text-base font-black text-white tracking-wider uppercase font-rajdhani">
                    Jal Shakti • Water Command
                  </h2>
                  <p className="text-cyan-400 text-[10px] font-mono tracking-widest uppercase">AMRUT 2.0 • 8 IMC Zones • IoT Telemetry</p>
                </div>
              </div>
              <button onClick={toggleJalShakti} className="w-8 h-8 rounded-lg bg-[#142642] text-slate-400 hover:text-white flex items-center justify-center transition-colors">✕</button>
            </div>

            {waterSummary && (
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                {[
                  { label: 'Zones', value: waterSummary.total_zones, color: 'text-cyan-400' },
                  { label: 'Critical', value: waterSummary.critical_zones, color: 'text-red-400' },
                  { label: 'Low', value: waterSummary.low_zones, color: 'text-amber-400' },
                  { label: 'Avg Tank', value: `${waterSummary.avg_tank_level_pct}%`, color: 'text-emerald-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#07111e] rounded-lg p-2 border border-[#1b2f4a]">
                    <p className={`font-black text-sm ${color}`}>{value}</p>
                    <p className="text-slate-500 text-[8px] uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {/* Active Alerts */}
            {waterAlerts.length > 0 && (
              <div>
                <p className="text-[10px] font-black tracking-widest text-red-400 uppercase mb-2">🚨 Real-time Supply Alerts</p>
                {waterAlerts.map(alert => (
                  <div key={alert.id} className={`p-3 rounded-lg border text-xs mb-2 ${
                    alert.severity === 'P1' ? 'bg-red-950/40 border-red-500/40 text-red-300' : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                  }`}>
                    <div className="flex justify-between items-start">
                      <p className="font-bold">{alert.message}</p>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-black ${
                        alert.severity === 'P1' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                      }`}>{alert.severity}</span>
                    </div>
                    <p className="text-slate-400 text-[10px] mt-1">{alert.affected_households?.toLocaleString()} households • AI: {alert.ai_confidence}%</p>
                  </div>
                ))}
              </div>
            )}

            {/* Zone Cards */}
            <div>
              <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2">8 IMC Water Distribution Sectors</p>
              {waterZones.map(zone => (
                <div
                  key={zone.zone_id}
                  onClick={() => {
                    setSelectedWaterZone(selectedWaterZone?.zone_id === zone.zone_id ? null : zone);
                    if (selectedWaterZone?.zone_id !== zone.zone_id) fetchZonePrediction(zone.zone_id);
                  }}
                  className={`mb-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedWaterZone?.zone_id === zone.zone_id
                      ? 'border-cyan-400 bg-cyan-950/20'
                      : 'border-[#1b2f4a] bg-[#0e1d35] hover:border-[#2a4a75]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zone.color }}></div>
                      <span className="text-white font-bold text-xs">{zone.zone_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                      zone.status === 'CRITICAL' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                      zone.status === 'LOW' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' :
                      'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    }`}>{zone.status}</span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Reservoir Tank</span>
                      <span className="font-bold text-white">{zone.tank_level_pct}% ({zone.tank_level_ML} ML)</span>
                    </div>
                    <div className="w-full bg-[#07111e] rounded-full h-1.5 border border-[#1b2f4a]">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${zone.tank_level_pct}%`,
                          backgroundColor: zone.tank_level_pct < 15 ? '#ef4444' : zone.tank_level_pct < 30 ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 mb-2 text-center text-[10px]">
                    <div className="bg-[#07111e] p-1 rounded border border-[#1b2f4a]">
                      <p className="font-bold text-white">{zone.pressure_bar} bar</p>
                      <p className="text-[8px] text-slate-500">Pressure</p>
                    </div>
                    <div className="bg-[#07111e] p-1 rounded border border-[#1b2f4a]">
                      <p className="font-bold text-white">{zone.flow_lpm} L/m</p>
                      <p className="text-[8px] text-slate-500">Flow</p>
                    </div>
                    <div className="bg-[#07111e] p-1 rounded border border-[#1b2f4a]">
                      <p className="font-bold text-white">{zone.supply_active ? '🟢 Active' : '🔴 Off'}</p>
                      <p className="text-[8px] text-slate-500">Pumping</p>
                    </div>
                  </div>

                  {/* Expanded: 24h LSTM Forecast */}
                  {selectedWaterZone?.zone_id === zone.zone_id && (
                    <div className="mt-3 pt-3 border-t border-[#1b2f4a]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">24h AI Supply Forecast</p>
                        {waterLoading && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
                      </div>
                      {waterPrediction && (
                        <>
                          <div className="flex gap-2 mb-2 text-center text-xs">
                            <div className="flex-1 bg-[#07111e] p-1.5 rounded border border-[#1b2f4a]">
                              <p className={`font-black ${waterPrediction.risk_level === 'CRITICAL' ? 'text-red-400' : 'text-emerald-400'}`}>{waterPrediction.risk_level}</p>
                              <p className="text-[8px] text-slate-500">Risk</p>
                            </div>
                            <div className="flex-1 bg-[#07111e] p-1.5 rounded border border-[#1b2f4a]">
                              <p className="text-cyan-400 font-black">{waterPrediction.ai_confidence}%</p>
                              <p className="text-[8px] text-slate-500">Confidence</p>
                            </div>
                            <div className="flex-1 bg-[#07111e] p-1.5 rounded border border-[#1b2f4a]">
                              <p className="text-white font-black">{waterPrediction.min_predicted_level_pct}%</p>
                              <p className="text-[8px] text-slate-500">Min Expected</p>
                            </div>
                          </div>

                          <div className="flex items-end gap-0.5 h-12">
                            {waterPrediction.forecast_hours.slice(0, 24).map((fh, i) => (
                              <div
                                key={i}
                                className="flex-1 rounded-sm transition-all"
                                style={{
                                  height: `${Math.max(4, fh.level_pct)}%`,
                                  backgroundColor: fh.has_supply
                                    ? fh.level_pct > 50 ? '#10b981' : fh.level_pct > 20 ? '#f59e0b' : '#ef4444'
                                    : '#1e293b',
                                }}
                                title={`${fh.hour_label}: ${fh.level_pct}%`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[7px] text-slate-500 mt-0.5 font-mono">
                            <span>Now</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-[#1b2f4a] text-center text-[9px] text-slate-500">
            Jal Jeevan Mission • Indore Municipal Corporation Central SCADA
          </div>
        </div>
      )}

      {/* 4. 🤖 ARIA AI CO-PILOT CHAT PANEL */}
      {showAria && (
        <div className="fixed bottom-6 right-6 z-[2500] w-[420px] max-h-[600px] flex flex-col rounded-2xl border border-sky-500/40 bg-[#0a1526]/98 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#14233c] to-[#0a1526] border-b border-[#1b2f4a]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-base">🤖</div>
              <div>
                <p className="text-white font-bold text-xs tracking-wider">ARIA AI Co-Pilot</p>
                <p className="text-sky-400 text-[9px] font-mono uppercase tracking-widest">ICCC Central LangChain Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <button onClick={() => setShowAria(false)} className="text-slate-400 hover:text-white text-base">✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px] max-h-[380px] custom-scrollbar">
            {ariaMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'aria' && (
                  <div className="w-6 h-6 rounded-md bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 text-xs">🤖</div>
                )}
                <div className={`max-w-[82%] flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.tool && msg.tool !== 'greet' && (
                    <span className="text-[8px] font-mono text-sky-400 uppercase tracking-widest px-1">
                      ⚡ Tool: {msg.tool.replace(/_/g, ' ')}
                    </span>
                  )}
                  <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-sky-600 text-white rounded-tr-none'
                      : 'bg-[#0e1d35] border border-[#1b2f4a] text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono px-1">{msg.time}</span>
                </div>
              </div>
            ))}
            {ariaLoading && (
              <div className="flex gap-2 items-center text-xs text-sky-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>ARIA is synthesizing municipal intelligence...</span>
              </div>
            )}
            <div ref={ariaBottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1 border-t border-[#1b2f4a] bg-[#07111e]/50">
            {['Find idle unit', 'Active incidents', 'City stats', 'Crime hotspots'].map(prompt => (
              <button
                key={prompt}
                onClick={() => setAriaInput(prompt)}
                className="text-[10px] font-bold text-sky-300 bg-[#142642] hover:bg-[#1a3459] border border-[#224574] px-2 py-0.5 rounded transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={sendAriaMessage} className="p-3 flex items-center gap-2 border-t border-[#1b2f4a]">
            <input
              type="text"
              value={ariaInput}
              onChange={e => setAriaInput(e.target.value)}
              placeholder="Query city metrics or suggest dispatch..."
              disabled={ariaLoading}
              className="flex-1 bg-[#07111e] border border-[#1b2f4a] focus:border-sky-500 text-white text-xs px-3 py-2 rounded-lg outline-none font-mono"
            />
            <button
              type="submit"
              disabled={ariaLoading || !ariaInput.trim()}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Send
            </button>
          </form>

        </div>
      )}

      {/* 5. 📷 FACETRACE MISSING PERSON SEARCH MODAL */}
      {showFaceTrace && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b172a] border border-purple-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#14233c] to-[#0b172a] border-b border-purple-500/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📷</span>
                <div>
                  <h2 className="text-white font-black text-base tracking-wider uppercase font-rajdhani">
                    FaceTrace • Missing Person Search Cell
                  </h2>
                  <p className="text-purple-400 text-[10px] font-mono tracking-widest uppercase">Indore Police Grid • DeepFace Biometrics AI</p>
                </div>
              </div>
              <button onClick={() => setShowFaceTrace(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: Input & Upload */}
              <div className="w-72 border-r border-[#1b2f4a] p-4 flex flex-col gap-3 shrink-0">
                <div
                  onClick={() => faceTraceFileRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-[#07111e] p-4 aspect-square flex flex-col items-center justify-center cursor-pointer transition-all text-center"
                >
                  {faceTracePreview ? (
                    <img src={faceTracePreview} className="w-full h-full object-cover rounded-lg" alt="Preview" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-purple-400 mb-2 opacity-70" />
                      <p className="text-purple-300 text-xs font-bold">Upload Subject Photo</p>
                      <p className="text-slate-500 text-[9px] mt-1">JPEG, PNG format</p>
                    </>
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
                  placeholder="Subject Name / Case ID"
                  className="bg-[#07111e] border border-[#1b2f4a] text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-purple-400"
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
                      const res = await axios.post(`${API_URL}/api/v1/facetrace/search`, fd, {
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
                  className="w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-colors"
                >
                  {faceTraceLoading ? 'Scanning 12 CCTV Feeds...' : '🔍 Scan City Surveillance Grid'}
                </button>

                {faceTraceResult && (
                  <div className="bg-[#07111e] p-3 rounded-lg border border-purple-500/30 text-xs space-y-1">
                    <p className="text-purple-400 text-[9px] font-black uppercase">Biometric Estimation</p>
                    <p className="text-slate-300">Age: <b className="text-white">~{faceTraceResult.face_analysis?.estimated_age} yrs</b></p>
                    <p className="text-slate-300">Gender: <b className="text-white">{faceTraceResult.face_analysis?.gender}</b></p>
                    <p className="text-slate-300">Confidence: <b className="text-emerald-400">{Math.round((faceTraceResult.face_analysis?.face_confidence || 0) * 100)}%</b></p>
                  </div>
                )}
              </div>

              {/* Right: Results */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                {!faceTraceResult && !faceTraceLoading && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-12">
                    <Camera className="w-12 h-12 text-slate-400 mb-2" />
                    <p className="text-slate-300 text-sm font-bold">No Active Search</p>
                    <p className="text-slate-500 text-xs mt-1">Upload a citizen portrait to initiate deep neural scanning across 12 smart cameras.</p>
                  </div>
                )}

                {faceTraceLoading && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 py-16">
                    <RefreshCw className="w-10 h-10 text-purple-400 animate-spin" />
                    <p className="text-purple-300 font-bold text-sm">DeepFace Scanning 12 Municipal Feeds...</p>
                  </div>
                )}

                {faceTraceResult && (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${
                      faceTraceResult.status === 'LOCATED' ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-red-950/40 border-red-500/50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-black text-base ${faceTraceResult.status === 'LOCATED' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {faceTraceResult.status === 'LOCATED' ? '✓ Subject Located on Surveillance Grid' : 'Subject Not Found'}
                          </p>
                          <p className="text-slate-300 text-xs mt-0.5">
                            {faceTraceResult.matches_found} match(es) across {faceTraceResult.cameras_scanned} camera nodes
                            {faceTraceResult.best_match && ` • Last sighted: ${faceTraceResult.best_match.camera_name}`}
                          </p>
                        </div>
                        <span className="text-slate-400 font-mono text-xs font-bold">CASE #{faceTraceResult.search_id}</span>
                      </div>
                    </div>

                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Camera Match Results</p>
                    <div className="grid grid-cols-2 gap-2">
                      {faceTraceResult.camera_results?.map(cam => (
                        <div
                          key={cam.camera_id}
                          className={`p-3 rounded-lg border text-xs ${
                            cam.is_match ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-[#07111e] border-[#1b2f4a]'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-white truncate max-w-[140px]">{cam.camera_name}</span>
                            <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                              cam.is_match ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-500'
                            }`}>{cam.confidence}%</span>
                          </div>
                          <p className="text-[10px] text-slate-400">Zone: {cam.zone}</p>
                          {cam.is_match && <p className="text-[10px] text-emerald-400 mt-1">🕒 Timestamp: {cam.last_seen}</p>}
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

      {/* 6. 🧾 AI E-CHALLAN MVA DISPUTE MODAL */}
      {showChallan && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b172a] rounded-2xl border border-amber-500/40 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-amber-500/30 bg-gradient-to-r from-[#14233c] to-[#0b172a] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚖️</span>
                <div>
                  <h2 className="text-white font-black text-base tracking-wider uppercase font-rajdhani">
                    AI E-Challan Dispute Engine
                  </h2>
                  <p className="text-amber-400 text-[10px] font-mono tracking-widest uppercase">
                    Motor Vehicles Act (MVA 2019) Legal Assessment & Notice Generator
                  </p>
                </div>
              </div>
              <button onClick={() => setShowChallan(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-5 gap-5">
                
                {/* Left: Upload Photo */}
                <div className="col-span-2 flex flex-col gap-3">
                  <input type="file" ref={challanFileRef} onChange={handleChallanUpload} accept="image/*" className="hidden" />
                  
                  {!challanFile ? (
                    <button
                      onClick={() => challanFileRef.current?.click()}
                      className="border-2 border-dashed border-amber-500/40 rounded-xl bg-[#07111e] hover:bg-amber-950/20 py-10 flex flex-col items-center justify-center text-amber-400 transition-colors"
                    >
                      <Camera className="w-10 h-10 mb-2 opacity-75" />
                      <span className="font-bold text-xs">Upload Physical Challan Photo</span>
                      <span className="text-[9px] text-slate-500 mt-1 uppercase">PNG, JPG format</span>
                    </button>
                  ) : (
                    <div className="relative rounded-xl border border-amber-500/30 overflow-hidden bg-black/50 group">
                      <img src={challanFile} className="w-full h-auto object-contain max-h-[360px]" alt="Challan" />
                      <button 
                        onClick={() => challanFileRef.current?.click()}
                        className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-white text-xs uppercase"
                      >
                        Rescan Different Document
                      </button>
                    </div>
                  )}

                  <div className="bg-[#07111e] rounded-lg p-3 border border-[#1b2f4a] text-xs text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300 text-[10px] uppercase">Automated Legal Assessment</p>
                    <p>• Scans speed/parking challans via EasyOCR engine.</p>
                    <p>• Validates procedural compliance against MVA 2019 regulations.</p>
                    <p>• Formally produces dispute representation PDF.</p>
                  </div>
                </div>

                {/* Right: Results */}
                <div className="col-span-3">
                  {challanLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 py-16">
                      <RefreshCw className="w-10 h-10 text-amber-400 animate-spin" />
                      <p className="text-amber-300 font-mono text-xs tracking-widest uppercase">NLP Processing Legal Clauses...</p>
                    </div>
                  ) : challanResult ? (
                    <div className="space-y-3.5">
                      
                      {/* Validity Score */}
                      <div className="bg-[#07111e] rounded-xl p-4 border border-[#1b2f4a] flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-0.5">MVA Procedural Score</p>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-black ${challanResult.validity.validity_score < 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {challanResult.validity.validity_score}
                            </span>
                            <span className="text-slate-500 text-sm font-bold">/ 100</span>
                          </div>
                          <p className="text-slate-300 font-bold text-xs mt-1">{challanResult.validity.summary}</p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${
                          challanResult.validity.recommendation.includes('STRONG') ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        }`}>
                          {challanResult.validity.recommendation.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Extracted Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#07111e] p-2.5 rounded-lg border border-[#1b2f4a]">
                          <span className="text-slate-500 text-[9px] uppercase block">Vehicle Number</span>
                          <span className="text-white font-mono font-bold text-xs">{challanResult.fields.vehicle_number || 'N/A'}</span>
                        </div>
                        <div className="bg-[#07111e] p-2.5 rounded-lg border border-[#1b2f4a]">
                          <span className="text-slate-500 text-[9px] uppercase block">Notice Date</span>
                          <span className="text-white font-bold text-xs">{challanResult.fields.challan_date_raw || 'N/A'}</span>
                        </div>
                        <div className="bg-[#07111e] p-2.5 rounded-lg border border-[#1b2f4a]">
                          <span className="text-slate-500 text-[9px] uppercase block">Penalty Sum</span>
                          <span className="text-red-400 font-bold text-xs">₹{challanResult.fields.fine_amount || 'N/A'}</span>
                        </div>
                        <div className="bg-[#07111e] p-2.5 rounded-lg border border-[#1b2f4a]">
                          <span className="text-slate-500 text-[9px] uppercase block">Alleged Offense</span>
                          <span className="text-white font-bold text-xs">{challanResult.fields.offense_description || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Dispute Grounds */}
                      {challanResult.validity.grounds?.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-slate-400 text-[9px] font-black uppercase">Statutory Defect Grounds</p>
                          {challanResult.validity.grounds.map((g, i) => (
                            <div key={i} className="p-2.5 rounded-lg border text-xs bg-[#07111e] border-amber-500/30">
                              <p className="font-bold text-amber-300">{g.description}</p>
                              <p className="text-slate-400 text-[10px] mt-0.5 font-mono">⚖️ {g.legal_basis}</p>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-[#1b2f4a] rounded-xl bg-[#07111e] py-16">
                      <FileText className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-xs">Upload a challan photo to view legal assessment</p>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#07111e] border-t border-[#1b2f4a] flex justify-between items-center">
              <p className="text-slate-500 text-xs">Legal extraction powered by EasyOCR & DeepSeek MVA Engine</p>
              <button
                onClick={downloadChallanPdf}
                disabled={!challanResult?.pdf_base64}
                className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <span>📄</span> Download Dispute Representation PDF
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 7. 📹 NAGRIK-DRISHTI LIVE STREAM MODAL */}
      {activeDrishtiId && (
        <div className="fixed inset-0 z-[3500] bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#0b172a] border border-red-500/40 rounded-2xl overflow-hidden shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#1b2f4a] bg-[#0e1d35]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDrishtiConnected && drishtiFrame ? 'bg-red-400' : 'bg-slate-500'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isDrishtiConnected && drishtiFrame ? 'bg-red-500' : 'bg-slate-600'}`}></span>
                </span>
                <div>
                  <p className="text-white font-bold text-sm uppercase font-rajdhani">Nagrik-Drishti • Citizen Video Stream</p>
                  <p className="text-slate-400 text-[10px] font-mono">
                    {isDrishtiConnected && drishtiFrame ? '🔴 LIVE STREAM ENCRYPTED & ACTIVE' : isDrishtiConnected ? '⏳ Awaiting live frames from citizen device...' : '🔌 Connecting to ICCC stream relay...'}
                  </p>
                </div>
              </div>
              <button onClick={closeDrishti} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <div className="w-full bg-[#07111e] relative flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
              {drishtiFrame ? (
                <img src={drishtiFrame} alt="Live Citizen Feed" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Radio className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
                  <p className="text-slate-300 text-xs font-bold uppercase">Relaying Secure WebSocket Signal...</p>
                  <p className="text-slate-500 text-[10px]">Case Reference ID: {activeDrishtiId}</p>
                </div>
              )}
            </div>

            <div className="px-4 py-3 flex justify-between items-center border-t border-[#1b2f4a] bg-[#07111e] text-[10px] text-slate-400">
              <span>ICCC Live Video Audit Protocol • Section 65B Certified</span>
              <button onClick={closeDrishti} className="bg-[#142642] text-slate-300 hover:text-white px-3 py-1 rounded font-bold uppercase">
                Terminate Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. 🖼️ FULL PHOTO EVIDENCE VIEWER MODAL */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[3500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-[#0b172a] rounded-2xl border border-[#1b2f4a] overflow-hidden p-2">
            <button onClick={() => setPreviewPhoto(null)} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center">✕</button>
            <img src={previewPhoto} alt="Full Evidence" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* 9. 🌐 DIGITAL TWIN 3D FULL-SCREEN VIEWER */}
      {showDigitalTwin && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[4000] bg-[#07111e] flex items-center justify-center text-center">
            <div>
              <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-white font-bold text-sm tracking-wider uppercase font-rajdhani">Initializing 3D Digital Twin GIS Mesh...</p>
            </div>
          </div>
        }>
          <DigitalTwin onClose={() => setShowDigitalTwin(false)} />
        </Suspense>
      )}

      {/* ─── ARIA AI FLOATING LAUNCHER ─── */}
      <button
        onClick={() => setShowAria(!showAria)}
        className={`fixed bottom-5 right-5 z-[1500] px-3.5 py-2 rounded-full flex items-center gap-2 font-bold text-xs uppercase tracking-wider shadow-2xl transition-all duration-300 border ${
          showAria
            ? 'bg-sky-500 text-slate-950 border-sky-300 scale-95 shadow-[0_0_25px_rgba(56,189,248,0.6)]'
            : 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white border-sky-400/50 hover:scale-105 shadow-[0_0_20px_rgba(37,99,235,0.4)]'
        }`}
        title="Toggle ARIA AI Assistant"
      >
        <span className="text-base">{showAria ? '✕' : '🤖'}</span>
        <span>ARIA AI Co-Pilot</span>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
      </button>

    </div>
  );
}

export default App;