import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';

// ==========================================
// CONFIGURATION
// ==========================================
const BACKEND_IP = "10.216.18.227"; // <-- Your Wi-Fi IP (auto-detected)
const API_BASE = `http://${BACKEND_IP}:8000/api/v1`;
const WS_BASE = `ws://${BACKEND_IP}:8000`;

export default function App() {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Login State
  const [aadhaar, setAadhaar] = useState('123456789123');
  const [phone, setPhone] = useState('1234567890');
  const [otp, setOtp] = useState('123456');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // SOS State
  const [location, setLocation] = useState(null);
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isRecordingSOS, setIsRecordingSOS] = useState(false); // <-- NEW: Voice SOS State
  const [activeProtocol, setActiveProtocol] = useState(null); // <-- NEW: Store survival guide
  const [isProtocolMinimized, setIsProtocolMinimized] = useState(false); // <-- NEW: Minimize guide
  const [currentIncidentId, setCurrentIncidentId] = useState(null); // <-- NEW: Track current case
  const [incidentStatus, setIncidentStatus] = useState(null); // <-- NEW: Live status updates
  const [activeTab, setActiveTab] = useState('sos'); // <-- NEW: Multi-tab navigation
  const [documents, setDocuments] = useState([]); // <-- NEW: Nagrik Vault documents
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null); // <-- NEW: For Document Modal
  const [eligibleSchemes, setEligibleSchemes] = useState([]); // <-- NEW: AI YojanaMatching
  const [isSchemesLoading, setIsSchemesLoading] = useState(false);
  const [fullProfile, setFullProfile] = useState(null); // <-- NEW: Total Public Data
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  // --- 🎯 NAGARSCORE GAMIFICATION STATE ---
  const [nagarScoreProfile, setNagarScoreProfile] = useState(null);
  const [isScoreLoading, setIsScoreLoading] = useState(false);

  // --- 🚌 NAGARYATRA SMART TRANSIT STATE ---
  const [transitBuses, setTransitBuses] = useState([]);
  const [transitStops, setTransitStops] = useState([]);
  const [isTransitLoading, setIsTransitLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('ROUTE-1');
  const [fromStop, setFromStop] = useState('');
  const [toStop, setToStop] = useState('');
  const [activeTicket, setActiveTicket] = useState(null);
  const [isBookingTicket, setIsBookingTicket] = useState(false);

  // --- 💰 NAGARKHATA MUNICIPAL BILLING STATE ---
  const [khataSummary, setKhataSummary] = useState(null);
  const [isKhataLoading, setIsKhataLoading] = useState(false);
  const [payingBillId, setPayingBillId] = useState(null);
  const [payingChallanId, setPayingChallanId] = useState(null);
  const [khataHistory, setKhataHistory] = useState([]);
  const [khataView, setKhataView] = useState('bills'); // 'bills' | 'history'

  // --- NAGRIK-DRISHTI STATE ---
  const [isDrishtiLive, setIsDrishtiLive] = useState(false);
  const [drishtiFrameCount, setDrishtiFrameCount] = useState(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const drishtiWsRef = useRef(null);
  const drishtiIntervalRef = useRef(null);

  // --- CAMERA GUARD ---
  const isCapturingRef = useRef(false);

  // --- NEW: GRIEVANCE (311) STATE ---
  const [grievanceCategory, setGrievanceCategory] = useState('Road/Pothole');
  const [grievanceDesc, setGrievanceDesc] = useState('');
  const [isReportingGrievance, setIsReportingGrievance] = useState(false);

  // Fallback initial notification
  const [notifications, setNotifications] = useState([{
    id: 'welcome_1',
    title: '🏛️ Welcome to NagarApp',
    message: 'Your smart city profile is synced. All local civic updates will appear here.',
    timestamp: new Date().toLocaleTimeString()
  }]);
  const [activeNotification, setActiveNotification] = useState(null);

  useEffect(() => {
    checkSavedToken();
  }, []);

  const checkSavedToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('nagariq_jwt');
      if (token) {
        setUserToken(token);
        fetchLocation(token);
      }
    } catch (e) {
      console.log("No token found");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocation = async (overrideToken = null) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need location access to send help.');
      return;
    }
    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
    checkHyperlocalAQI(loc.coords, overrideToken || userToken);
  };

  const checkHyperlocalAQI = async (coords, token) => {
    if (!token) return;
    try {
      const res = await axios.post(`${API_BASE}/environment/aqi/check`, {
        lat: coords.latitude,
        lng: coords.longitude
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.data.status === 'alert') {
        const newNotif = {
           id: Math.random().toString(),
           title: "🚨 Hazardous Air Quality Alert",
           message: res.data.message,
           timestamp: new Date().toLocaleTimeString()
        };
        setNotifications(prev => [...prev, newNotif]);
        setActiveNotification(newNotif);
        Alert.alert("🌿 Vayu AQI Alert", res.data.message);
      }
    } catch (e) {
      console.log("AQI check failed:", e);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/verify-otp`, {
        aadhaar_number: aadhaar,
        phone: phone,
        otp: otp
      });
      const token = res.data.access_token;
      await SecureStore.setItemAsync('nagariq_jwt', token);
      setUserToken(token);
      fetchLocation(token);
    } catch (error) {
      Alert.alert("Login Failed", "Invalid details or Server offline.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('nagariq_jwt');
    setUserToken(null);
    setLocation(null);
    setImageUri(null);
  };

  // --- OPEN CAMERA / GALLERY ---
  const openCamera = async () => {
    // Prevent re-entrancy (double-tap or camera already open)
    if (isCapturingRef.current) return;

    Alert.alert(
      'Add Photo Evidence',
      'Choose how to add a photo:',
      [
        { text: '📸 Camera', onPress: () => openImageSource('camera') },
        { text: '🖼 Gallery', onPress: () => openImageSource('gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const openImageSource = async (source) => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera Denied', 'Please allow camera access in your device settings.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.4,
          base64: true,
          exif: false,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Gallery Denied', 'Please allow gallery access in your device settings.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.4,
          base64: true,
          exif: false,
        });
      }

      if (result && !result.canceled && result.assets?.[0]) {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64);
      }
    } catch (err) {
      console.log('Camera/Gallery error:', err);
      Alert.alert('Error', 'Could not open camera/gallery. Please try again.');
    } finally {
      isCapturingRef.current = false;
    }
  };

  // --- NEW: VOICE SOS WITH WHISPER AI MOCK ---
  const handleVoiceSOS = async () => {
    if (!location) {
      Alert.alert("Hold on!", "Waiting for GPS...");
      return;
    }
    
    setIsRecordingSOS(true);
    // Simulate 3 seconds of user speaking in Hindi/Malvi
    setTimeout(async () => {
      setIsRecordingSOS(false);
      setIsSending(true);
      try {
        const response = await axios.post(`${API_BASE}/sos/voice`, {
          lat: location.latitude,
          lng: location.longitude,
          audioBase64: "dummy_audio_file"
        }, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        
        Alert.alert(
          "Voice SOS Dispatched!",
          `Transcribed & Translated:\n"${response.data.description || "Emergency detected"}"\n\nHelp is on the way!`
        );

        if (response.data.protocol) {
          setActiveProtocol(response.data.protocol);
          setCurrentIncidentId(response.data.incident_id);
          setIncidentStatus({ status: 'active', unit: null });
        }
      } catch (error) {
        Alert.alert("Voice SOS Failed", "Check your network connection.");
      } finally {
        setIsSending(false);
      }
    }, 3000);
  };

  const triggerSOS = async () => {
    if (!location) {
      Alert.alert("Hold on!", "Still locking onto your GPS coordinates...");
      return;
    }
    if (!description.trim() && !imageBase64) {
      Alert.alert("Wait!", "Please type a description or take a photo of the emergency.");
      return;
    }

    setIsSending(true);
    try {
      // Note: We are now sending the base64 image data too!
      const response = await axios.post(`${API_BASE}/sos`, {
        lat: location.latitude,
        lng: location.longitude,
        channel: "app",
        description: description,
        image: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null
      }, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      Alert.alert(
        "SOS Dispatched!",
        `Help is on the way.\n\nAI Detected: ${response.data.ai_prediction}\nConfidence: ${response.data.confidence}`
      );

      // --- NEW: Trigger Guided Protocol ---
      if (response.data.protocol) {
        setActiveProtocol(response.data.protocol);
        setCurrentIncidentId(response.data.incident_id);
        setIncidentStatus({ status: 'active', unit: null });
      }

      // Reset form
      setDescription('');
      setImageUri(null);
      setImageBase64(null);
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert("Session Expired", "Please log in again.");
        handleLogout();
      } else {
        Alert.alert("Connection Error", "Could not reach the NagarIQ server.");
      }
    } finally {
      setIsSending(false);
    }
  };

  // --- NAGRIK-DRISHTI: START LIVE STREAM ---
  const startDrishti = async () => {
    if (!currentIncidentId) {
      Alert.alert('Send SOS First', 'Please trigger an SOS before starting the live stream.');
      return;
    }
    // Request camera permission
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission Denied', 'Cannot start live stream without camera access.');
        return;
      }
    }
    // Open WebSocket to backend relay
    const ws = new WebSocket(`${WS_BASE}/ws/drishti/${currentIncidentId}/stream`);
    drishtiWsRef.current = ws;

    ws.onopen = () => {
      setIsDrishtiLive(true);
      setDrishtiFrameCount(0);
      // Capture & send frames every 300ms
      drishtiIntervalRef.current = setInterval(async () => {
        try {
          if (cameraRef.current && ws.readyState === WebSocket.OPEN) {
            const photo = await cameraRef.current.takePictureAsync({
              base64: true,
              quality: 0.25,   // Low quality to keep bandwidth minimal
              skipProcessing: true,
            });
            ws.send(`data:image/jpeg;base64,${photo.base64}`);
            setDrishtiFrameCount(c => c + 1);
          }
        } catch (e) { /* frame capture can fail silently */ }
      }, 300);
    };

    ws.onerror = () => {
      Alert.alert('Stream Error', 'Could not connect to the ICCC relay. Ensure backend is running.');
      stopDrishti();
    };

    ws.onclose = () => {
      stopDrishti();
    };
  };

  // --- NAGRIK-DRISHTI: STOP LIVE STREAM ---
  const stopDrishti = () => {
    if (drishtiIntervalRef.current) {
      clearInterval(drishtiIntervalRef.current);
      drishtiIntervalRef.current = null;
    }
    if (drishtiWsRef.current) {
      drishtiWsRef.current.close();
      drishtiWsRef.current = null;
    }
    setIsDrishtiLive(false);
  };

  const fetchDocuments = async () => {
    setIsDocsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/nagrik/documents`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      setDocuments(res.data.documents);
    } catch (e) {
      console.log("Failed to fetch docs", e);
    } finally {
      setIsDocsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'vault' && userToken) {
      fetchDocuments();
    }
    if (activeTab === 'schemes' && userToken) {
      fetchEligibleSchemes();
    }
    if (activeTab === 'wallet' && userToken) {
      fetchFullProfile();
      fetchKhataData();
    }
    if (activeTab === 'score' && userToken) {
      fetchNagarScore();
    }
    if (activeTab === 'transit' && userToken) {
      fetchTransitData();
    }
  }, [activeTab]);

  const fetchNagarScore = async () => {
    setIsScoreLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/nagarscore/profile/CIT-007`);
      if (res.data.status === 'success') setNagarScoreProfile(res.data.profile);
    } catch (e) { console.log("Score fetch failed", e); }
    finally { setIsScoreLoading(false); }
  };

  const fetchTransitData = async () => {
    setIsTransitLoading(true);
    try {
      const [busRes, stopRes] = await Promise.all([
        axios.get(`${API_BASE}/transit/buses`),
        axios.get(`${API_BASE}/transit/stops`),
      ]);
      if (busRes.data.status === 'success') setTransitBuses(busRes.data.buses);
      if (stopRes.data.status === 'success') setTransitStops(stopRes.data.stops);
    } catch (e) { console.log('Transit fetch failed', e); }
    finally { setIsTransitLoading(false); }
  };

  const bookTicket = async () => {
    if (!fromStop || !toStop) { Alert.alert('Select Stops', 'Please select both a departure and destination stop.'); return; }
    if (fromStop === toStop) { Alert.alert('Invalid Route', 'From and To stops cannot be the same.'); return; }
    setIsBookingTicket(true);
    try {
      const res = await axios.post(`${API_BASE}/transit/ticket/issue`, {
        citizen_id: 'CIT-007',
        route_id: selectedRoute,
        from_stop: fromStop,
        to_stop: toStop,
      }, { headers: { 'Authorization': `Bearer ${userToken}` } });
      if (res.data.status === 'success') {
        setActiveTicket(res.data.ticket);
        // Award NagarScore points for using public transit
        await axios.post(`${API_BASE}/nagarscore/award/CIT-007`, { action: 'REPORT_POTHOLE' });
      }
    } catch (e) { Alert.alert('Booking Failed', 'Could not issue ticket. Please try again.'); }
    finally { setIsBookingTicket(false); }
  };

  const fetchKhataData = async () => {
    setIsKhataLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/khata/summary/CIT-007`);
      if (res.data.status === 'success') setKhataSummary(res.data.summary);
    } catch (e) { console.log('Khata fetch failed', e); }
    finally { setIsKhataLoading(false); }
  };

  const payBill = async (billId) => {
    setPayingBillId(billId);
    try {
      const res = await axios.post(
        `${API_BASE}/khata/pay/CIT-007/${billId}`,
        { payment_method: 'UPI' },
        { headers: { 'Authorization': `Bearer ${userToken}` } }
      );
      if (res.data.status === 'success') {
        Alert.alert('✅ Payment Successful', `Receipt ID: ${res.data.receipt.payment_id}\n\nYou earned +200 NagarScore XP!`);
        fetchKhataData(); // refresh bill list
        // Fetch history too
        const hRes = await axios.get(`${API_BASE}/khata/history/CIT-007`, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (hRes.data.status === 'success') setKhataHistory(hRes.data.history);
      }
    } catch (e) { 
      const msg = e.response?.data?.detail || e.response?.data?.message || 'Please try again.';
      Alert.alert('Payment Failed', msg); 
      fetchKhataData(); // Refresh bills in case backend restarted
    }
    finally { setPayingBillId(null); }
  };

  const payChallan = async (challanId) => {
    setPayingChallanId(challanId);
    try {
      const res = await axios.post(
        `${API_BASE}/nagrik/wallet/pay/${challanId}`,
        {},
        { headers: { 'Authorization': `Bearer ${userToken}` } }
      );
      if (res.data.status === 'success') {
        Alert.alert('✅ Challan Paid', `${res.data.message}\n\nYou earned +50 NagarScore XP!`);
        fetchFullProfile(); // refresh challan list
      } else {
        Alert.alert('Payment Failed', res.data.message);
      }
    } catch (e) { 
      const msg = e.response?.data?.detail || e.response?.data?.message || 'Please try again.';
      Alert.alert('Payment Failed', msg); 
      fetchFullProfile(); // Refresh profile in case backend restarted
    }
    finally { setPayingChallanId(null); }
  };

  const fetchKhataHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/khata/history/CIT-007`, { headers: { 'Authorization': `Bearer ${userToken}` } });
      if (res.data.status === 'success') setKhataHistory(res.data.history);
    } catch (e) { console.log('History fetch failed', e); }
  };

  const fetchFullProfile = async () => {
    setIsProfileLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/nagrik/profile/full`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      setFullProfile(res.data.data);
    } catch (e) { console.log("Failed profile fetch", e); }
    finally { setIsProfileLoading(false); }
  };

  const handleReportGrievance = async () => {
    if (!grievanceDesc) return Alert.alert("Error", "Please describe the issue.");
    setIsReportingGrievance(true);
    try {
      // Get current location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert("Error", "Location access needed.");
      let loc = await Location.getCurrentPositionAsync({});
      
      const res = await axios.post(`${API_BASE}/grievances`, {
        category: grievanceCategory,
        description: grievanceDesc,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude
      }, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      if (res.data.status === 'success') {
        Alert.alert(
            "Grievance Reported!",
            `AI Prioritization: Level ${res.data.priority}/5\n\nYour issue has been logged in the City Health system.`,
            [{ text: "OK", onPress: () => {
                setGrievanceDesc('');
                setActiveTab('sos'); // Reset to home
            }}]
        );
      }
    } catch (e) {
      console.log("Grievance error", e);
      Alert.alert("Error", "Failed to report issue.");
    } finally {
      setIsReportingGrievance(false);
    }
  };

  const fetchEligibleSchemes = async () => {
    setIsSchemesLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/nagrik/schemes/eligible`, {
        age: 24, income: 450000, occupation: 'Freelancer', gender: 'Any', state: 'MP'
      }, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      setEligibleSchemes(res.data.schemes);
    } catch (e) {
      console.log("Failed schemes fetch", e);
    } finally {
      setIsSchemesLoading(false);
    }
  };

  const handleVaultUpload = async () => {
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    if (!result.canceled) {
      Alert.alert("Nagrik AI Parsing...", "Processing with EasyOCR + IndicBERT...");
      try {
        const res = await axios.post(`${API_BASE}/nagrik/vault/upload`, {
          image: result.assets[0].base64
        }, {
           headers: { 'Authorization': `Bearer ${userToken}` }
        });
        
        const { parsed_data } = res.data;
        Alert.alert(
          "AI Parsing Success",
          `NagarIQ AI has analyzed your document:\n\n` +
          `📄 Type: ${parsed_data.doc_type}\n` +
          `👤 Name: ${parsed_data.extracted_name}\n` +
          `💰 Income: ${parsed_data.annual_income}\n\n` +
          `Your eligibility for schemes has been updated.`
        );
        fetchDocuments();
        if (activeTab === 'schemes') fetchEligibleSchemes();
      } catch (e) {
        Alert.alert("Error", "Parsing failed.");
      }
    }
  };

  // --- NEW: Live Polling for Incident Status ---
  useEffect(() => {
    let interval;
    if (activeProtocol && currentIncidentId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/incidents`);
          const myIncident = res.data.data.find(inc => inc.id === currentIncidentId);
          if (myIncident) {
            setIncidentStatus({ 
              status: myIncident.status, 
              unit: myIncident.assigned_unit 
            });
            
            if (myIncident.status === 'resolved') {
              Alert.alert("Case Resolved", "Emergency services have marked this as resolved. Stay safe!");
              setActiveProtocol(null);
              setCurrentIncidentId(null);
              setIncidentStatus(null);
            }
          }
        } catch (e) {
          console.log("Polling error", e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeProtocol, currentIncidentId]);

  // --- NEW: Polling for Notifications ---
  useEffect(() => {
    let notifInterval;
    if (userToken) {
      notifInterval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/nagrik/notifications`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
          });
          if (res.data.notifications && res.data.notifications.length > 0) {
            setNotifications(res.data.notifications);
            // Auto-open newest notification if none active
            if (!activeNotification) {
              setActiveNotification(res.data.notifications[res.data.notifications.length - 1]);
            }
          }
        } catch (e) { /* silent */ }
      }, 5000);
    }
    return () => clearInterval(notifInterval);
  }, [userToken, activeNotification]);

  const clearNotifications = async () => {
    try {
      await axios.post(`${API_BASE}/nagrik/notifications/clear`, {}, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
    } catch (e) {
      console.log("Clear failed", e);
    } finally {
      setNotifications([]);
      setActiveNotification(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 200 }} />
      </View>
    );
  }

  if (!userToken) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>NagarIQ</Text>
          <Text style={styles.subtitle}>Citizen Authentication</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.label}>Aadhaar Number</Text>
          <TextInput style={styles.input} value={aadhaar} onChangeText={setAadhaar} keyboardType="numeric" />
          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="numeric" />
          <Text style={styles.label}>OTP</Text>
          <TextInput style={styles.input} value={otp} onChangeText={setOtp} keyboardType="numeric" secureTextEntry />
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>VERIFY & LOGIN</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerBrand}>NagarIQ</Text>
          <Text style={styles.title}>
            {activeTab === 'sos' ? 'Suraksha' : activeTab === 'vault' ? 'Vault' : activeTab === 'wallet' ? 'Wallet' : activeTab === '311' ? 'Indore-311' : activeTab === 'schemes' ? 'Yojana' : activeTab === 'transit' ? 'NagarYatra' : 'NagarScore'}
          </Text>
        </View>
        
        <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.iconCircle}
              onPress={() => notifications.length > 0 && setActiveNotification(notifications[notifications.length-1])}
            >
                <Text style={{ fontSize: 18 }}>{notifications.length > 0 ? '🔔' : '🔕'}</Text>
                {notifications.length > 0 && <View style={styles.notifBadge} />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconCircle, { marginLeft: 10 }]} onPress={handleLogout}>
                <Text style={{ fontSize: 18 }}>🚪</Text>
            </TouchableOpacity>
        </View>
      </View>
      
      {/* Hide main content when a protocol is active AND not minimized */}
      {(!activeProtocol || isProtocolMinimized) ? (
        activeTab === 'sos' ? (
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Describe the Emergency:</Text>
            <TextInput
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
              placeholder="e.g., bhaiya jaldi aao yaha aag lag gayi hai..."
              placeholderTextColor="#64748b"
              multiline={true}
              value={description}
              onChangeText={setDescription}
            />

            {/* --- NEW CAMERA & VOICE UI --- */}
            <View style={styles.cameraRow}>
              <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
                <Text style={styles.cameraButtonText}>📎 Add Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.cameraButton, { backgroundColor: isRecordingSOS ? '#ef4444' : '#1e293b' }]} 
                onPress={handleVoiceSOS}
                disabled={isRecordingSOS}
              >
                <Text style={[styles.cameraButtonText, { color: isRecordingSOS ? '#fff' : '#cbd5e1' }]}>
                  {isRecordingSOS ? '🎙️ Listening...' : '🎙️ Speak'}
                </Text>
              </TouchableOpacity>

              {imageUri && (
                <TouchableOpacity onPress={() => { setImageUri(null); setImageBase64(null); }}>
                  <Image source={{ uri: imageUri }} style={styles.thumbnail} />
                  <Text style={{ color: '#ef4444', fontSize: 10, textAlign: 'center', marginTop: 2 }}>✕ Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.sosButton, isSending && styles.sosButtonDisabled]}
              onPress={triggerSOS}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#ffffff" size="large" />
              ) : (
                <Text style={styles.sosText}>SEND SOS</Text>
              )}
            </TouchableOpacity>

            {/* --- NAGRIK-DRISHTI: LIVE VIDEO FEED --- */}
            {currentIncidentId && (
              <View style={styles.drishtiContainer}>
                {isDrishtiLive ? (
                  <View style={styles.drishtiLiveBox}>
                    <CameraView
                      ref={cameraRef}
                      style={styles.drishtiCamera}
                      facing="back"
                    />
                    <View style={styles.drishtiOverlay}>
                      <View style={styles.drishtiLiveBadge}>
                        <View style={styles.drishtiPulse} />
                        <Text style={styles.drishtiLiveText}>🔴 LIVE</Text>
                        <Text style={styles.drishtiFrameText}>{drishtiFrameCount} frames</Text>
                      </View>
                      <TouchableOpacity style={styles.drishtiStopBtn} onPress={stopDrishti}>
                        <Text style={styles.drishtiStopText}>■ STOP</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.drishtiStartBtn} onPress={startDrishti}>
                    <Text style={styles.drishtiStartIcon}>📡</Text>
                    <Text style={styles.drishtiStartTitle}>Start Nagrik-Drishti</Text>
                    <Text style={styles.drishtiStartSub}>Stream live video to ICCC dispatcher</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.gpsCard}>
              {location ? (
                <Text style={styles.gpsText}>🟢 GPS Locked: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</Text>
              ) : (
                <Text style={styles.gpsText}>⏳ Acquiring GPS...</Text>
              )}
            </View>
          </ScrollView>
        ) : activeTab === 'vault' ? (
          /* --- NEW: NAGRIK360 VAULT UI --- */
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.vaultHeaderRow}>
               <View>
                  <Text style={styles.vaultTitle}>Digital Vault</Text>
                  <Text style={styles.vaultSubtitle}>Verified by DigiLocker & UIDAI</Text>
               </View>
               <View style={styles.encBadge}>
                  <Text style={styles.encText}>🛡️ AES-256</Text>
               </View>
            </View>
            
            {isDocsLoading ? (
              <ActivityIndicator color="#38bdf8" style={{ marginTop: 50 }} />
            ) : (
              <View style={styles.docList}>
                {documents.map((doc) => (
                  <TouchableOpacity 
                    key={doc.id} 
                    style={styles.docCard}
                    onPress={() => setSelectedDoc(doc)}
                  >
                    <View style={styles.docIcon}>
                      <Text style={{ fontSize: 24 }}>📄</Text>
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docName}>{doc.name}</Text>
                      <Text style={styles.docIssuer}>{doc.issuer}</Text>
                      <View style={styles.docMeta}>
                        <Text style={styles.docSync}>🔄 {doc.last_synced}</Text>
                        <Text style={styles.docBadge}>{doc.status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.uploadFab} onPress={handleVaultUpload}>
               <Text style={styles.uploadFabText}>⚡ Smart Scan</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : activeTab === 'wallet' ? (
          /* --- NEW: UNIFIED CITIZEN WALLET UI --- */
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.vaultTitle}>Nagrik Wallet</Text>
            <Text style={styles.vaultSubtitle}>Unified Public Data & Dues</Text>
            
            {isProfileLoading ? (
              <ActivityIndicator color="#38bdf8" style={{ marginTop: 50 }} />
            ) : fullProfile && (
              <View style={{ flex: 1 }}>
                {/* --- CHALLANS SECTION --- */}
                <Text style={styles.sectionHeader}>🚦 Traffic Challans</Text>
                {fullProfile.challans.map(ch => (
                  <View key={ch.id} style={[styles.walletCard, ch.status === 'Paid' && { borderLeftColor: '#22c55e' }]}>
                    <View style={styles.walletRow}>
                        <View>
                            <Text style={styles.cardMainText}>{ch.reason}</Text>
                            <Text style={styles.cardSubText}>{ch.vehicle} • {ch.date}</Text>
                            <Text style={styles.cardSubText}>ID: {ch.id}</Text>
                        </View>
                        <Text style={[styles.cardPrice, ch.status === 'Paid' && { color: '#22c55e' }]}>
                          {ch.status === 'Paid' ? 'PAID' : `₹${ch.amount}`}
                        </Text>
                    </View>
                    {ch.status !== 'Paid' && (
                      <TouchableOpacity 
                        style={[styles.payBtn, payingChallanId === ch.id && { opacity: 0.7 }]} 
                        onPress={() => payChallan(ch.id)}
                        disabled={payingChallanId === ch.id}
                      >
                        {payingChallanId === ch.id ? (
                          <ActivityIndicator color="#0f172a" size="small" />
                        ) : (
                          <Text style={styles.payBtnText}>Pay Fine Now</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* --- 💰 MUNICIPAL KHATA (IMC BILLS) SECTION --- */}
                <Text style={[styles.sectionHeader, { marginTop: 20 }]}>⚡ IMC Municipal Bills & Taxes</Text>
                
                {isKhataLoading || !khataSummary ? (
                  <ActivityIndicator color="#22c55e" style={{ marginTop: 20, marginBottom: 20 }} />
                ) : (
                  <View>
                    {/* NagarScore Discount Banner */}
                    {khataSummary.tier_discount_pct > 0 && (
                      <View style={{ backgroundColor: '#14532d', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#16a34a', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 28 }}>🏆</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#4ade80', fontWeight: 'bold', fontSize: 14 }}>NagarScore Benefit Active!</Text>
                          <Text style={{ color: '#86efac', fontSize: 12, marginTop: 2 }}>
                            Your Gold/Platinum tier saves you {khataSummary.tier_discount_pct}% automatically.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Financial Summary Cards */}
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                      <View style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#ef4444', alignItems: 'center' }}>
                        <Text style={{ color: '#fca5a5', fontSize: 22, fontWeight: 'bold' }}>₹{khataSummary.total_pending_amount}</Text>
                        <Text style={{ color: '#64748b', fontSize: 10, marginTop: 4, textAlign: 'center' }}>TOTAL DUE</Text>
                        {khataSummary.overdue_count > 0 && (
                          <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 6 }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{khataSummary.overdue_count} OVERDUE</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#22c55e', alignItems: 'center' }}>
                        <Text style={{ color: '#86efac', fontSize: 22, fontWeight: 'bold' }}>₹{khataSummary.total_discount_saved}</Text>
                        <Text style={{ color: '#64748b', fontSize: 10, marginTop: 4, textAlign: 'center' }}>SAVED (NagarScore)</Text>
                      </View>
                    </View>

                    {/* Bills / History Toggle */}
                    <View style={{ flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                      {['bills', 'history'].map(v => (
                        <TouchableOpacity
                          key={v}
                          onPress={() => { setKhataView(v); if (v === 'history') fetchKhataHistory(); }}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: khataView === v ? '#1e40af' : 'transparent' }}
                        >
                          <Text style={{ color: khataView === v ? '#bfdbfe' : '#475569', fontWeight: 'bold', fontSize: 12 }}>
                            {v === 'bills' ? '📋 Current Bills' : '🧾 History'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {khataView === 'bills' ? (
                      /* Bill Cards */
                      <View>
                        {khataSummary.bills.map((bill) => (
                          <View key={bill.bill_id} style={{
                            backgroundColor: '#1e293b',
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 12,
                            borderLeftWidth: 3,
                            borderLeftColor: bill.status === 'paid' ? '#22c55e' : bill.status === 'overdue' ? '#ef4444' : '#f59e0b',
                          }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: 15 }}>{bill.icon} {bill.label}</Text>
                                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{bill.department}</Text>
                                <Text style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>Due: {bill.due_date}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: bill.status === 'paid' ? '#4ade80' : '#f8fafc', fontWeight: 'bold', fontSize: 18 }}>
                                  {bill.status === 'paid' ? 'PAID' : `₹${bill.final_amount}`}
                                </Text>
                                {bill.discount_amount > 0 && bill.status !== 'paid' && (
                                  <Text style={{ color: '#22c55e', fontSize: 10 }}>-₹{bill.discount_amount} discount</Text>
                                )}
                              </View>
                            </View>

                            {/* Status Badge */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ backgroundColor: bill.status === 'paid' ? '#14532d' : bill.status === 'overdue' ? '#450a0a' : '#451a03', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                <Text style={{ color: bill.status === 'paid' ? '#4ade80' : bill.status === 'overdue' ? '#fca5a5' : '#fcd34d', fontSize: 10, fontWeight: 'bold' }}>
                                  {bill.status === 'paid' ? '✅ PAID' : bill.status === 'overdue' ? '🔴 OVERDUE' : '🟡 PENDING'}
                                </Text>
                              </View>

                              {bill.status !== 'paid' && (
                                <TouchableOpacity
                                  onPress={() => payBill(bill.bill_id)}
                                  disabled={payingBillId === bill.bill_id}
                                  style={{ backgroundColor: bill.status === 'overdue' ? '#dc2626' : '#1d4ed8', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                >
                                  {payingBillId === bill.bill_id ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                  ) : (
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>⚡ Pay via UPI</Text>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      /* Payment History */
                      <View>
                        {khataHistory.length === 0 ? (
                          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <Text style={{ fontSize: 40 }}>🧾</Text>
                            <Text style={{ color: '#475569', fontSize: 14, marginTop: 12 }}>No payments yet</Text>
                          </View>
                        ) : khataHistory.map((receipt) => (
                          <View key={receipt.payment_id} style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#22c55e' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: 13 }}>{receipt.bill_label}</Text>
                              <Text style={{ color: '#4ade80', fontWeight: 'bold', fontSize: 14 }}>₹{receipt.amount_paid}</Text>
                            </View>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>📋 {receipt.payment_id}</Text>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>📅 {receipt.paid_at_human}</Text>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>💳 {receipt.payment_method} • Ref: {receipt.upi_ref}</Text>
                            {receipt.discount_applied > 0 && (
                              <Text style={{ color: '#22c55e', fontSize: 10, marginTop: 4 }}>🏆 NagarScore saved you ₹{receipt.discount_applied}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* --- HEALTH PROFILE --- */}
                <Text style={[styles.sectionHeader, { marginTop: 20 }]}>🏥 Digital Health Locker</Text>
                <View style={styles.healthCard}>
                    <View style={styles.healthRow}>
                        <View style={styles.healthItem}>
                            <Text style={styles.healthLabel}>BLOOD GROUP</Text>
                            <Text style={styles.healthValue}>{fullProfile.health.blood_group}</Text>
                        </View>
                        <View style={styles.healthItem}>
                            <Text style={styles.healthLabel}>ABHA ID</Text>
                            <Text style={styles.healthValue}>{fullProfile.health.abua_id}</Text>
                        </View>
                    </View>
                    <Text style={[styles.healthLabel, { marginTop: 10 }]}>ALLERGIES</Text>
                    <Text style={styles.healthValue}>{fullProfile.health.allergies.join(', ')}</Text>
                </View>

                {/* --- VEHICLES HUB --- */}
                <Text style={[styles.sectionHeader, { marginTop: 20 }]}>🚙 My Vehicles (e-Parivahan)</Text>
                {fullProfile.vehicles.map(v => (
                  <View key={v.id} style={styles.vehicleCard}>
                    <View style={styles.vehicleIcon}>
                        <Text style={{ fontSize: 20 }}>🚗</Text>
                    </View>
                    <View>
                        <Text style={styles.vehiclePlate}>{v.plate}</Text>
                        <Text style={styles.vehicleModel}>{v.model}</Text>
                        <Text style={styles.vehiclePuc}>PUC Valid until: {v.puc_valid_until}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : activeTab === '311' ? (
            /* --- NEW: INDORE-311 GRIEVANCE UI --- */
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
                <Text style={styles.vaultTitle}>Indore-311</Text>
                <Text style={styles.vaultSubtitle}>Report City Maintenance Issues</Text>
                
                <View style={[styles.walletCard, { width: '100%', padding: 20, borderLeftColor: '#f59e0b' }]}>
                    <Text style={[styles.label, { marginBottom: 10 }]}>Issue Category:</Text>
                    <View style={styles.categoryGrid}>
                        {['Road/Pothole', 'Street Light', 'Garbage', 'Water Leak', 'Sewerage'].map(cat => (
                            <TouchableOpacity 
                                key={cat} 
                                style={[styles.catBtn, grievanceCategory === cat && styles.catBtnActive]}
                                onPress={() => setGrievanceCategory(cat)}
                            >
                                <Text style={[styles.catBtnText, grievanceCategory === cat && styles.catBtnTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[styles.label, { marginTop: 20, marginBottom: 10 }]}>Description:</Text>
                    <TextInput
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                        placeholder="e.g. Major pothole near Rajwada crossing, dangerous for bikers..."
                        placeholderTextColor="#64748b"
                        multiline
                        value={grievanceDesc}
                        onChangeText={setGrievanceDesc}
                    />

                    <TouchableOpacity 
                        style={[styles.reportBtn, isReportingGrievance && { opacity: 0.6 }]} 
                        onPress={handleReportGrievance}
                        disabled={isReportingGrievance}
                    >
                        {isReportingGrievance ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.reportBtnText}>REPORT TO NAGAR NIGAM</Text>}
                    </TouchableOpacity>
                </View>
                
                <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>🤖 AI-Powered Priority Analysis Active</Text>
                </View>
            </ScrollView>
        ) : activeTab === 'schemes' ? (
          /* --- NEW: AI YOJANA (SCHEMES) UI --- */
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.vaultTitle}>Yojana Matching</Text>
            <Text style={styles.vaultSubtitle}>AI-Matched Government Benefits</Text>
            
            {isSchemesLoading ? (
              <ActivityIndicator color="#38bdf8" style={{ marginTop: 50 }} />
            ) : (
              <View style={styles.docList}>
                {eligibleSchemes.map((sch) => (
                  <View key={sch.id} style={styles.schemeCard}>
                    <View style={styles.schemeHeader}>
                      <Text style={styles.schemeCategory}>{sch.category}</Text>
                      <Text style={styles.schemeMatch}>MATCHED</Text>
                    </View>
                    <Text style={styles.schemeName}>{sch.name}</Text>
                    <Text style={styles.schemeBenefit}>🎁 {sch.benefit}</Text>
                    <TouchableOpacity 
                      style={styles.applyBtn}
                      onPress={() => Linking.openURL(sch.url)}
                    >
                        <Text style={styles.applyBtnText}>Apply Now</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : activeTab === 'transit' ? (
          /* --- 🚌 NAGARYATRA SMART TRANSIT UI --- */
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.vaultTitle}>NagarYatra</Text>
            <Text style={styles.vaultSubtitle}>iBus Live Tracker & NagarPass Ticketing</Text>

            {/* Live Bus Status */}
            {isTransitLoading ? (
              <ActivityIndicator color="#3b82f6" style={{ marginTop: 30 }} />
            ) : (
              <View style={styles.docList}>
                <Text style={[styles.vaultSubtitle, {color:'#60a5fa', marginBottom: 8}]}>🚌 Live Bus Status</Text>
                {transitBuses.map((bus) => (
                  <View key={bus.id} style={[styles.healthCard, { borderColor: '#3b82f6', borderLeftColor: '#3b82f6', marginBottom: 10 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: 14 }}>{bus.id}</Text>
                      <View style={{ backgroundColor: '#1e3a5f', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                        <Text style={{ color: '#93c5fd', fontSize: 10, fontWeight: 'bold' }}>LIVE</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#e2e8f0', fontSize: 12, marginBottom: 4 }}>🗺️ {bus.route_name}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 11 }}>🚏 Next: <Text style={{color:'#fff', fontWeight:'bold'}}>{bus.next_stop_name}</Text> in ~{bus.eta_minutes} min</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>👥 {bus.occupancy}/{bus.capacity} passengers ({bus.occupancy_pct}% full)</Text>
                    {/* Occupancy bar */}
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 4, height: 4, marginTop: 8 }}>
                      <View style={{ backgroundColor: bus.occupancy_pct > 80 ? '#ef4444' : bus.occupancy_pct > 50 ? '#f97316' : '#10b981', borderRadius: 4, height: 4, width: `${bus.occupancy_pct}%` }} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* NagarPass Ticket Booking */}
            <View style={[styles.healthCard, { borderColor: '#6366f1', borderLeftColor: '#6366f1', marginTop: 16 }]}>
              <Text style={{ color: '#a5b4fc', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>🎫 NagarPass — Book Ticket</Text>

              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Select Route</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {['ROUTE-1', 'ROUTE-2', 'ROUTE-3'].map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => { setSelectedRoute(r); setFromStop(''); setToStop(''); }}
                    style={{ backgroundColor: selectedRoute === r ? '#4f46e5' : '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: selectedRoute === r ? '#6366f1' : '#334155' }}
                  >
                    <Text style={{ color: selectedRoute === r ? '#e0e7ff' : '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>From Stop</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {transitStops.filter(s => s.route_id === selectedRoute).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setFromStop(s.name)}
                    style={{ backgroundColor: fromStop === s.name ? '#0f766e' : '#1e293b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: fromStop === s.name ? '#14b8a6' : '#334155' }}
                  >
                    <Text style={{ color: fromStop === s.name ? '#ccfbf1' : '#94a3b8', fontSize: 11 }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>To Stop</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {transitStops.filter(s => s.route_id === selectedRoute && s.name !== fromStop).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setToStop(s.name)}
                    style={{ backgroundColor: toStop === s.name ? '#7c3aed' : '#1e293b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: toStop === s.name ? '#8b5cf6' : '#334155' }}
                  >
                    <Text style={{ color: toStop === s.name ? '#ede9fe' : '#94a3b8', fontSize: 11 }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={bookTicket}
                disabled={isBookingTicket}
                style={{ backgroundColor: isBookingTicket ? '#374151' : '#4f46e5', padding: 14, borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                  {isBookingTicket ? 'Generating Ticket...' : '🎫 Issue NagarPass QR Ticket'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Active Ticket Display */}
            {activeTicket && (
              <View style={[styles.healthCard, { borderColor: '#10b981', borderLeftColor: '#10b981', marginTop: 16, alignItems: 'center' }]}>
                <Text style={{ color: '#34d399', fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>✅ Ticket Issued!</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 16 }}>Show this QR to the bus conductor</Text>

                {/* Simulated QR Code block */}
                <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 }}>
                  <View style={{ width: 160, height: 160, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                    {Array.from({length: 100}).map((_, i) => (
                      <View key={i} style={{ width: 16, height: 16, backgroundColor: Math.random() > 0.5 ? '#000' : '#fff', margin: 0 }} />
                    ))}
                  </View>
                </View>

                <Text style={{ color: '#e2e8f0', fontWeight: 'bold', fontSize: 13 }}>{activeTicket.ticket_id}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>🗺️ {activeTicket.route_name}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11 }}>📍 {activeTicket.from_stop} → {activeTicket.to_stop}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 12, backgroundColor: '#0f172a', borderRadius: 10, padding: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 20 }}>₹{activeTicket.fare}</Text>
                    <Text style={{ color: '#64748b', fontSize: 10 }}>FARE</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 12 }}>VALID 2 HRS</Text>
                    <Text style={{ color: '#64748b', fontSize: 10 }}>DURATION</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: activeTicket.status === 'active' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: 12 }}>{activeTicket.status.toUpperCase()}</Text>
                    <Text style={{ color: '#64748b', fontSize: 10 }}>STATUS</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setActiveTicket(null)} style={{ marginTop: 12 }}>
                  <Text style={{ color: '#64748b', fontSize: 11 }}>Clear Ticket</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        ) : (
          /* --- 🎯 NAGARSCORE GAMIFICATION UI --- */
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.vaultTitle}>NagarScore</Text>
            <Text style={styles.vaultSubtitle}>Your Civic Reputation & Rewards</Text>
            
            {isScoreLoading || !nagarScoreProfile ? (
              <ActivityIndicator color="#eab308" style={{ marginTop: 50 }} />
            ) : (
              <View>
                {/* Profile Card */}
                <View style={[styles.healthCard, { borderColor: '#eab308', borderLeftColor: '#eab308' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                      <Text style={{ fontSize: 30 }}>{nagarScoreProfile.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>{nagarScoreProfile.name}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>ID: {nagarScoreProfile.id}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.healthRow}>
                    <View style={styles.healthItem}>
                      <Text style={styles.healthLabel}>City Rank</Text>
                      <Text style={[styles.healthValue, { color: '#eab308' }]}>#{nagarScoreProfile.rank} <Text style={{fontSize: 10, color: '#64748b'}}>/ {nagarScoreProfile.total_citizens}</Text></Text>
                    </View>
                    <View style={styles.healthItem}>
                      <Text style={styles.healthLabel}>Civic XP</Text>
                      <Text style={[styles.healthValue, { color: '#eab308' }]}>{nagarScoreProfile.score}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.healthRow}>
                    <View style={styles.healthItem}>
                      <Text style={styles.healthLabel}>Current Tier</Text>
                      <Text style={[styles.healthValue, { color: '#eab308' }]}>{nagarScoreProfile.tier}</Text>
                    </View>
                  </View>
                </View>

                {/* Badges */}
                <Text style={[styles.sectionTitle, { marginTop: 10, marginBottom: 15 }]}>Earned Badges</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {nagarScoreProfile.badges.map((b, i) => (
                    <View key={i} style={{ backgroundColor: '#1e293b', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#334155' }}>
                      <Text style={{ color: '#eab308', fontWeight: 'bold' }}>🎖️ {b}</Text>
                    </View>
                  ))}
                  {nagarScoreProfile.badges.length === 0 && <Text style={{ color: '#64748b', fontStyle: 'italic' }}>No badges earned yet.</Text>}
                </View>

                {/* Rewards Layer */}
                <Text style={[styles.sectionTitle, { marginTop: 25, marginBottom: 15 }]}>Available Civic Rewards</Text>
                
                <View style={[styles.docItem, { opacity: nagarScoreProfile.score >= 500 ? 1 : 0.5 }]}>
                  <Text style={{ fontSize: 24, marginRight: 15 }}>🚌</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>1 Free iBus Ride</Text>
                    <Text style={styles.docType}>AiCTSL Transit</Text>
                  </View>
                  <Text style={{ color: '#eab308', fontWeight: 'bold' }}>500 XP</Text>
                </View>

                <View style={[styles.docItem, { opacity: nagarScoreProfile.score >= 2000 ? 1 : 0.5 }]}>
                  <Text style={{ fontSize: 24, marginRight: 15 }}>🅿️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>1 Month Smart Parking</Text>
                    <Text style={styles.docType}>Municipal Lots</Text>
                  </View>
                  <Text style={{ color: '#eab308', fontWeight: 'bold' }}>2000 XP</Text>
                </View>

                <View style={[styles.docItem, { opacity: nagarScoreProfile.score >= 5000 ? 1 : 0.5 }]}>
                  <Text style={{ fontSize: 24, marginRight: 15 }}>📜</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>5% Tax Discount</Text>
                    <Text style={styles.docType}>Property / Garbage Tax</Text>
                  </View>
                  <Text style={{ color: '#eab308', fontWeight: 'bold' }}>5000 XP</Text>
                </View>

              </View>
            )}
          </ScrollView>
        )
      ) : (
        /* Empty space if protocol is active AND NOT minimized */
        <View style={styles.content} />
      )}

      {/* Show footer when NO active non-minimized protocol */}
      {(!activeProtocol || isProtocolMinimized) && (
        <View style={styles.footer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}
          >
            <TouchableOpacity 
              style={[styles.navItem, activeTab === 'sos' && styles.navItemActive]} 
              onPress={() => setActiveTab('sos')}
            >
              <Text style={styles.navEmoji}>🚨</Text>
              <Text style={[styles.navText, activeTab === 'sos' && styles.navTextActive]}>SOS</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navItem, activeTab === 'vault' && styles.navItemActive]} 
              onPress={() => setActiveTab('vault')}
            >
              <Text style={styles.navEmoji}>🔐</Text>
              <Text style={[styles.navText, activeTab === 'vault' && styles.navTextActive]}>Vault</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navItem, activeTab === 'wallet' && styles.navItemActive]} 
              onPress={() => setActiveTab('wallet')}
            >
              <Text style={styles.navEmoji}>💳</Text>
              <Text style={[styles.navText, activeTab === 'wallet' && styles.navTextActive]}>Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navItem, activeTab === '311' && styles.navItemActive]} 
              onPress={() => setActiveTab('311')}
            >
              <Text style={styles.navEmoji}>🏗️</Text>
              <Text style={[styles.navText, activeTab === '311' && styles.navTextActive]}>311</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navItem, activeTab === 'schemes' && styles.navItemActive]} 
              onPress={() => setActiveTab('schemes')}
            >
              <Text style={styles.navEmoji}>🎓</Text>
              <Text style={[styles.navText, activeTab === 'schemes' && styles.navTextActive]}>Yojana</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navItem, activeTab === 'score' && styles.navItemActive]} 
              onPress={() => setActiveTab('score')}
            >
              <Text style={styles.navEmoji}>🏆</Text>
              <Text style={[styles.navText, activeTab === 'score' && styles.navTextActive]}>Score</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navItem, activeTab === 'transit' && styles.navItemActive]} 
              onPress={() => setActiveTab('transit')}
            >
              <Text style={styles.navEmoji}>🚌</Text>
              <Text style={[styles.navText, activeTab === 'transit' && styles.navTextActive]}>Transit</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* --- FLOATING PROTOCOL PILL (when minimized) --- */}
      {activeProtocol && isProtocolMinimized && (
        <TouchableOpacity
          style={styles.protocolPill}
          onPress={() => setIsProtocolMinimized(false)}
        >
          <View style={styles.protocolPillDot} />
          <Text style={styles.protocolPillText}>🛡️ {activeProtocol.title} — Tap to reopen guide</Text>
        </TouchableOpacity>
      )}

      {/* --- GUIDED PROTOCOL OVERLAY --- */}
      {activeProtocol && !isProtocolMinimized && (
        <View style={styles.protocolOverlay}>
          <View style={styles.protocolCard}>

            {/* Header row with title + minimize + severity */}
            <View style={styles.protocolHeader}>
              <Text style={styles.protocolTitle}>{activeProtocol.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.severityBadge, { backgroundColor: activeProtocol.severity === 'P1' ? '#ef4444' : '#f97316' }]}>
                  <Text style={styles.severityText}>{activeProtocol.severity}</Text>
                </View>
                <TouchableOpacity
                  style={styles.minimizeBtn}
                  onPress={() => setIsProtocolMinimized(true)}
                >
                  <Text style={[styles.minimizeBtnText, { fontSize: 16, marginTop: -2 }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.protocolSubtitle}>Follow these steps immediately:</Text>

            <View style={styles.stepsContainer}>
              {activeProtocol.steps.map((step, index) => (
                <View key={index} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Live Status Display */}
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>RESPONDER STATUS:</Text>
              <View style={styles.statusInner}>
                {incidentStatus?.status === 'dispatched' ? (
                  <Text style={styles.statusTextActive}>🚑 {incidentStatus.unit} IS EN ROUTE</Text>
                ) : (
                  <Text style={styles.statusTextPending}>⏳ Waiting for Dispatcher...</Text>
                )}
              </View>
            </View>

            {/* Action Buttons Row */}
            <TouchableOpacity 
              style={styles.closeProtocolBtn}
              onPress={async () => {
                try {
                  await axios.patch(`${API_BASE}/incidents/${currentIncidentId}/status`, {
                    status: 'resolved'
                  }, { headers: { 'Authorization': `Bearer ${userToken}` } });
                } catch (e) {
                  console.log('Failed to mark resolved', e);
                }
                setActiveProtocol(null);
                setIsProtocolMinimized(false);
                setCurrentIncidentId(null);
                setIncidentStatus(null);
              }}
            >
              <Text style={styles.closeProtocolText}>✅ I AM SAFE / HELP ARRIVED</Text>
            </TouchableOpacity>

          </View>
        </View>
      )}

      {/* --- NEW: PUSH NOTIFICATION MODAL --- */}
      {activeNotification && (
        <View style={styles.protocolOverlay}>
          <View style={styles.notifModal}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={styles.notifIconCircle}>
                    <Text style={{ fontSize: 32 }}>📢</Text>
                </View>
            </View>
            <Text style={styles.notifModalTitle}>{activeNotification.title}</Text>
            <Text style={styles.notifModalMsg}>{activeNotification.message}</Text>
            <Text style={styles.notifModalTime}>{activeNotification.timestamp}</Text>
            
            <TouchableOpacity 
                style={styles.notifActionBtn}
                onPress={() => {
                   setActiveTab('schemes');
                   clearNotifications();
                }}
            >
                <Text style={styles.notifActionText}>VIEW SCHEMES</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => clearNotifications()}>
                <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 15, fontSize: 12, fontWeight: 'bold' }}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --- NEW: DOCUMENT DETAIL MODAL --- */}
      {selectedDoc && (
        <View style={styles.protocolOverlay}>
          <View style={styles.docModalCard}>
            <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>{selectedDoc.name}</Text>
               <TouchableOpacity onPress={() => setSelectedDoc(null)}>
                  <Text style={{ color: '#94a3b8', fontSize: 20 }}>✕</Text>
               </TouchableOpacity>
            </View>

            <View style={styles.qrContainer}>
               <View style={styles.qrBox}>
                  <View style={{ gap: 4 }}>
                     <View style={{ flexDirection: 'row', gap: 4 }}>
                        <View style={styles.qrPixelActive} /><View style={styles.qrPixelActive} /><View style={styles.qrPixel} /><View style={styles.qrPixelActive} />
                     </View>
                     <View style={{ flexDirection: 'row', gap: 4 }}>
                        <View style={styles.qrPixel} /><View style={styles.qrPixelActive} /><View style={styles.qrPixelActive} /><View style={styles.qrPixel} />
                     </View>
                     <View style={{ flexDirection: 'row', gap: 4 }}>
                        <View style={styles.qrPixelActive} /><View style={styles.qrPixel} /><View style={styles.qrPixelActive} /><View style={styles.qrPixelActive} />
                     </View>
                  </View>
                  <Text style={styles.qrToken}>{selectedDoc.verify_token}</Text>
               </View>
               <Text style={styles.qrHint}>Official Verification QR</Text>
            </View>

            <View style={styles.docDetailsBox}>
               <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DOCUMENT NUMBER</Text>
                  <Text style={styles.detailValue}>{selectedDoc.number}</Text>
               </View>
               <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ISSUING AUTHORITY</Text>
                  <Text style={styles.detailValue}>{selectedDoc.issuer}</Text>
               </View>
            </View>

            <TouchableOpacity 
              style={styles.closeProtocolBtn} 
              onPress={() => setSelectedDoc(null)}
            >
              <Text style={styles.closeProtocolText}>CLOSE VAULT</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1d' },
  header: {
    paddingTop: 60, paddingBottom: 15, backgroundColor: '#161e33',
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2d3748',
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20
  },
  headerLeft: { flexDirection: 'column' },
  headerBrand: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  iconCircle: { width: 40, height: 40, backgroundColor: '#1e293b', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  logoutText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 120 },
  label: { color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#161e33', color: '#ffffff', borderWidth: 1, borderColor: '#2d3748',
    borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20,
  },
  cameraRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  cameraButton: {
    backgroundColor: '#1e293b', paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 12, borderWidth: 1, borderColor: '#334155', flex: 1, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center'
  },
  cameraButtonText: { color: '#cbd5e1', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  thumbnail: { width: 55, height: 55, borderRadius: 12, borderWidth: 2, borderColor: '#38bdf8' },
  loginButton: {
    backgroundColor: '#38bdf8', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 10,
    shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  buttonText: { color: '#0a0f1d', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  sosButton: {
    backgroundColor: '#f43f5e', paddingVertical: 30, borderRadius: 24, alignItems: 'center',
    shadowColor: '#f43f5e', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15, marginBottom: 24,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)'
  },
  sosButtonDisabled: { backgroundColor: '#4c0519', shadowOpacity: 0 },
  sosText: { color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  gpsCard: { backgroundColor: '#161e33', padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2d3748' },
  gpsText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  
  // Protocol Styles
  protocolOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 29, 0.98)',
    justifyContent: 'center',
    padding: 20,
  },
  protocolCard: {
    backgroundColor: '#161e33',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  protocolTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    flex: 1,
    marginRight: 10,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  severityText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase'
  },
  protocolSubtitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 20
  },
  stepsContainer: {
    marginBottom: 30
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2
  },
  stepNumberText: {
    color: '#0a0f1d',
    fontSize: 14,
    fontWeight: '900'
  },
  stepText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 24,
    flex: 1,
    fontWeight: '500'
  },
  closeProtocolBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },
  closeProtocolText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5
  },
  statusBox: {
    backgroundColor: '#0a0f1d',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2d3748'
  },
  statusLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  statusInner: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusTextPending: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '900'
  },
  statusTextActive: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900'
  },
  
  // Vault Styles
  vaultTitle: { color: '#ffffff', fontSize: 28, fontWeight: '900', marginBottom: 6 },
  vaultSubtitle: { color: '#38bdf8', fontSize: 11, marginBottom: 25, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 'bold' },
  docList: { gap: 12 },
  docCard: {
    backgroundColor: '#161e33',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3748',
    marginBottom: 12
  },
  docIcon: {
    width: 54,
    height: 54,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  docInfo: { flex: 1 },
  docName: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  docIssuer: { color: '#94a3b8', fontSize: 13, marginBottom: 10 },
  docMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docSync: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  docBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: '#10b981'
  },

  // Footer Styles
  footer: {
    flexDirection: 'row',
    backgroundColor: '#161e33',
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
    justifyContent: 'space-around'
  },
  navItem: { alignItems: 'center', opacity: 0.4, minWidth: 58, paddingHorizontal: 6 },
  navItemActive: { opacity: 1 },
  navEmoji: { fontSize: 20, marginBottom: 4 },
  navText: { color: '#94a3b8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  navTextActive: { color: '#38bdf8' },

  // Vault Enhancements
  vaultHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  encBadge: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  encText: { color: '#38bdf8', fontSize: 10, fontWeight: '900' },
  docModalCard: {
    backgroundColor: '#0a0f1d',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: '#38bdf8',
    width: '100%',
    shadowColor: '#38bdf8', shadowOpacity: 0.2, shadowRadius: 40
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  qrContainer: { alignItems: 'center', marginBottom: 35 },
  qrBox: { 
    backgroundColor: '#ffffff', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowRadius: 20,
    shadowOpacity: 0.1
  },
  qrPixel: { width: 8, height: 8, backgroundColor: '#e2e8f0' },
  qrPixelActive: { width: 8, height: 8, backgroundColor: '#0a0f1d' },
  qrToken: { marginTop: 12, fontSize: 11, color: '#0a0f1d', fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  qrHint: { marginTop: 12, color: '#94a3b8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  docDetailsBox: { backgroundColor: '#161e33', borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: '#2d3748' },
  detailRow: { marginBottom: 20 },
  detailLabel: { color: '#64748b', fontSize: 11, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase' },
  detailValue: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  // Yojana Styles
  schemeCard: { backgroundColor: '#161e33', borderRadius: 20, padding: 18, marginBottom: 15, borderLeftWidth: 5, borderLeftColor: '#38bdf8', borderWidth: 1, borderColor: '#2d3748' },
  schemeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  schemeCategory: { color: '#38bdf8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  schemeMatch: { color: '#10b981', fontSize: 11, fontWeight: '900' },
  schemeName: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  schemeBenefit: { color: '#94a3b8', fontSize: 14, marginBottom: 18, lineHeight: 20 },
  applyBtn: { backgroundColor: '#38bdf8', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  applyBtnText: { color: '#0a0f1d', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },

  // Vault FAB
  uploadFab: { 
    backgroundColor: '#38bdf8', 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 20,
    shadowColor: '#38bdf8', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5
  },
  uploadFabText: { color: '#0a0f1d', fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', fontSize: 14 },
  notifBadge: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, backgroundColor: '#f43f5e', borderRadius: 6, borderWidth: 2, borderColor: '#161e33' },
  notifModal: { backgroundColor: '#161e33', borderRadius: 32, padding: 30, width: '90%', borderWidth: 1, borderColor: '#38bdf8' },
  notifIconCircle: { width: 80, height: 80, backgroundColor: '#0a0f1d', borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#38bdf8', marginBottom: 20 },
  notifModalTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  notifModalMsg: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 30 },
  notifModalTime: { color: '#38bdf8', fontSize: 12, fontWeight: '900', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase' },
  notifActionBtn: { backgroundColor: '#38bdf8', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  notifActionText: { color: '#0a0f1d', fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },

  // Unified Wallet Styles
  sectionHeader: { color: '#38bdf8', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 15, marginTop: 10 },
  walletCard: { backgroundColor: '#161e33', borderRadius: 20, padding: 18, marginBottom: 15, borderLeftWidth: 5, borderLeftColor: '#fbbf24', borderWidth: 1, borderColor: '#2d3748' },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardMainText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  cardSubText: { color: '#64748b', fontSize: 12, marginTop: 4 },
  cardPrice: { color: '#fbbf24', fontSize: 18, fontWeight: '900' },
  payBtn: { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderWidth: 1, borderColor: '#38bdf8', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  payBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  
  healthCard: { backgroundColor: '#161e33', borderRadius: 20, padding: 20, marginBottom: 15, borderLeftWidth: 5, borderLeftColor: '#f43f5e', borderWidth: 1, borderColor: '#2d3748' },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  healthItem: { flex: 1 },
  healthLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  healthValue: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginTop: 6 },
  
  vehicleCard: { backgroundColor: '#161e33', borderRadius: 20, padding: 18, marginBottom: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#2d3748' },
  vehicleIcon: { width: 50, height: 50, backgroundColor: '#0a0f1d', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  vehiclePlate: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  vehicleModel: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  vehiclePuc: { color: '#10b981', fontSize: 11, marginTop: 8, fontWeight: '900', textTransform: 'uppercase' },

  // Grievance Styles
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#2d3748', backgroundColor: '#1e293b' },
  catBtnActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)' },
  catBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  catBtnTextActive: { color: '#38bdf8', fontWeight: '900' },
  reportBtn: { backgroundColor: '#38bdf8', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 30, shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  reportBtnText: { color: '#0a0f1d', fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', fontSize: 15 },
  aiBadge: { marginTop: 25, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#10b981', alignSelf: 'center' },
  aiBadgeText: { color: '#10b981', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },

  // Nagrik-Drishti Styles
  drishtiContainer: { marginTop: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#ef4444' },
  drishtiStartBtn: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  drishtiStartIcon: { fontSize: 36 },
  drishtiStartTitle: { color: '#ef4444', fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  drishtiStartSub: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  drishtiLiveBox: { height: 200, position: 'relative' },
  drishtiCamera: { width: '100%', height: '100%' },
  drishtiOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  drishtiLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  drishtiPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  drishtiLiveText: { color: '#ffffff', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  drishtiFrameText: { color: '#94a3b8', fontSize: 10 },
  drishtiStopBtn: { backgroundColor: 'rgba(239,68,68,0.8)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  drishtiStopText: { color: '#ffffff', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  // Protocol Minimize / Pill Styles
  minimizeBtn: { backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: '#38bdf8', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  minimizeBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: '900' },
  protocolPill: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    backgroundColor: '#161e33', borderWidth: 1, borderColor: '#ef4444',
    borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8, zIndex: 99,
  },
  protocolPillDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  protocolPillText: { color: '#ffffff', fontSize: 12, fontWeight: '700', flex: 1 },
});