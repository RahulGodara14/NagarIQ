import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from './config.js';
import * as Cesium from 'cesium';

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN || '';

const INDORE = { lon: 75.8577, lat: 22.7196 };

const AQI_FOG_MAP = [
  { max: 50,  density: 0.00004 },
  { max: 100, density: 0.00010 },
  { max: 200, density: 0.00030 },
  { max: 300, density: 0.00070 },
  { max: 500, density: 0.00150 },
];

function unitType(u) {
  const n = (u.name || u.id || '').toLowerCase();
  if (n.includes('pol') || n.includes('patrol')) return { emoji: '🚓', color: '#3b82f6' };
  if (n.includes('fire')) return { emoji: '🚒', color: '#f97316' };
  return { emoji: '🚑', color: '#ef4444' };
}

function mkCanvas(emoji, bg, w = 56, h = 56) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 10);
  ctx.fill();
  ctx.font = `${Math.round(w * 0.5)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, w / 2, h / 2 + 2);
  return c.toDataURL();
}

export default function DigitalTwin({ onClose }) {
  const containerRef = useRef(null);
  const viewerRef    = useRef(null);
  const entitiesRef  = useRef({ units: {}, incidents: {}, loaded: false });
  const intervalRef  = useRef(null);
  const cssLinkRef   = useRef(null);

  const [status,   setStatus]   = useState('Initializing…');
  const [ready,    setReady]    = useState(false);
  const [stats,    setStats]    = useState({ units: 0, incidents: 0, hospitals: 0 });
  const [aqi,      setAqi]      = useState(72);
  const [layers,   setLayers]   = useState({
    units: true, hospitals: true, flood: true, aqiFog: true,
  });

  /* ── inject Cesium CSS without polluting global styles ── */
  useEffect(() => {
    // vite-plugin-cesium copies Cesium files → served at /cesium/
    // We inject dynamically so it only applies when Digital Twin is open
    // and it doesn't break Leaflet's CSS on the main map
    const links = [
      '/cesium/Widgets/widgets.css',
      '/Cesium/Widgets/widgets.css', // alternate path
    ];

    const tryLink = (urls, idx = 0) => {
      if (idx >= urls.length) return;
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = urls[idx];
      link.id   = 'cesium-widget-css';
      link.onerror = () => { link.remove(); tryLink(urls, idx + 1); };
      document.head.appendChild(link);
      cssLinkRef.current = link;
    };

    tryLink(links);
    return () => { cssLinkRef.current?.remove(); };
  }, []);


  /* ── main Cesium init ── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Set Ion token FIRST before any async calls
        if (CESIUM_TOKEN) {
          Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;
          console.log('[DigitalTwin] Ion token set ✅');
        } else {
          console.warn('[DigitalTwin] No Ion token — terrain & buildings disabled');
        }

        /* ── Viewer ── */
        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayerPicker:      false,
          navigationHelpButton: false,
          sceneModePicker:      false,
          geocoder:             false,
          homeButton:           false,
          fullscreenButton:     false,
          animation:            false,
          timeline:             false,
          infoBox:              true,
          selectionIndicator:   true,
          shadows:              false,
          shouldAnimate:        true,
        });

        if (cancelled) { viewer.destroy(); return; }
        viewerRef.current = viewer;

        /* ── Imagery Layer (CORS-safe) ── */
        setStatus('Loading map imagery…');
        viewer.imageryLayers.removeAll();

        if (CESIUM_TOKEN) {
          // Cesium Ion serves Bing Maps with proper CORS headers
          try {
            const ionImg = await Cesium.IonImageryProvider.fromAssetId(3); // Bing + labels
            viewer.imageryLayers.addImageryProvider(ionImg);
            console.log('[DigitalTwin] Ion Bing Maps imagery loaded ✅');
          } catch (e) {
            console.warn('[DigitalTwin] Ion imagery failed:', e.message);
            // Fallback: OpenStreetMap — CORS-enabled, free, no key needed
            viewer.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                maximumLevel: 19,
                credit: '© OpenStreetMap contributors',
              })
            );
          }
        } else {
          // No token: OpenStreetMap — free, CORS-enabled tile server
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              maximumLevel: 19,
              credit: '© OpenStreetMap contributors',
            })
          );
          console.log('[DigitalTwin] OpenStreetMap imagery loaded ✅ (no Ion token)');
        }

        if (CESIUM_TOKEN) {
          /* ── Terrain ── */
          setStatus('Loading 3D terrain…');
          try {
            const terrain = await Cesium.createWorldTerrainAsync({
              requestVertexNormals: true,
            });
            viewer.terrainProvider = terrain;
            // Only enable depth testing when terrain is actually loaded
            // (flat ellipsoid + depthTest = buildings disappear underground)
            viewer.scene.globe.depthTestAgainstTerrain = false;
            console.log('[DigitalTwin] World terrain loaded ✅');
          } catch (e) {
            console.warn('[DigitalTwin] Terrain failed:', e.message);
          }

          /* ── 3D Buildings — Ion Asset #96188
             REQUIRED: Add to your account at ion.cesium.com/assetdepot/96188 ── */
          setStatus('Loading 3D buildings…');
          try {
            const buildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188, {
              maximumScreenSpaceError: 8, // lower = more detail loaded (default 16)
            });
            // Style buildings as transparent "glass" so the real satellite map rooftops show through
            buildings.style = new Cesium.Cesium3DTileStyle({
              color: "color('#ffffff', 0.15)", // 15% opacity white (glass effect)
            });
            viewer.scene.primitives.add(buildings);
            console.log('[DigitalTwin] OSM Buildings 3D tileset loaded ✅');
          } catch (e) {
            console.warn('[DigitalTwin] Buildings failed (add asset 96188 to Ion account):', e.message);
            try {
              const b2 = await Cesium.createOsmBuildingsAsync({
                style: new Cesium.Cesium3DTileStyle({
                  color: "color('#ffffff', 0.15)", // 15% opacity glass effect
                })
              });
              viewer.scene.primitives.add(b2);
              console.log('[DigitalTwin] Buildings loaded via createOsmBuildingsAsync fallback ✅');
            } catch (e2) {
              console.warn('[DigitalTwin] Both building loaders failed:', e2.message);
            }
          }
        }

        /* ── Atmosphere ── */
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled        = true;
        viewer.scene.fog.density        = 0.0001;
        viewer.scene.logarithmicDepthBuffer = true;

        /* ── Fly to Indore — low enough to see buildings ── */
        setStatus('Flying to Indore…');
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(INDORE.lon, INDORE.lat, 700),
          orientation: {
            heading: Cesium.Math.toRadians(20),
            pitch:   Cesium.Math.toRadians(-30),  // shallower = more horizon visible
            roll:    0,
          },
          duration: 2.5,
        });


        setReady(true);
        setStatus('Digital Twin Active');

        /* ── First data load + polling ── */
        await loadAll(Cesium, viewer);
        intervalRef.current = setInterval(() => loadAll(Cesium, viewer), 5000);

      } catch (err) {
        console.error('[DigitalTwin] Fatal init error:', err);
        setStatus('Error: ' + err.message);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);


  /* ── Layer visibility ── */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const refs = entitiesRef.current;
    Object.values(refs.units).forEach(e => e && (e.show = layers.units));
  }, [layers.units]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.fog.enabled = layers.aqiFog;
  }, [layers.aqiFog]);

  /* ── Data loaders ── */
  const loadAll = async (Cesium, viewer) => {
    if (!viewer || viewer.isDestroyed()) return;
    await Promise.allSettled([
      loadUnits(Cesium, viewer),
      loadIncidents(Cesium, viewer),
      loadStaticLayers(Cesium, viewer),
      updateAqi(viewer),
    ]);
  };

  const loadUnits = async (Cesium, viewer) => {
    const res = await axios.get(`${API_URL}/api/v1/routing/units`);
    const units = res.data?.data || [];
    setStats(s => ({ ...s, units: units.length }));

    units.forEach(u => {
      const { emoji, color } = unitType(u);
      const img = mkCanvas(emoji, u.status === 'idle' ? '#10b981' : color);
      const pos = Cesium.Cartesian3.fromDegrees(u.lng, u.lat, 8);

      if (entitiesRef.current.units[u.id]) {
        entitiesRef.current.units[u.id].position = pos;
      } else {
        const e = viewer.entities.add({
          position: pos,
          show: layers.units,
          billboard: {
            image: img, width: 44, height: 44,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          description: `<b>${u.name || u.id}</b><br/>Status: ${u.status}`,
        });
        entitiesRef.current.units[u.id] = e;
      }
    });
  };

  const loadIncidents = async (Cesium, viewer) => {
    const res = await axios.get(`${API_URL}/api/v1/incidents`);
    const incidents = (res.data?.incidents || []).filter(i => i.status !== 'resolved');
    setStats(s => ({ ...s, incidents: incidents.length }));

    // Remove resolved
    const activeSet = new Set(incidents.map(i => i.id));
    Object.entries(entitiesRef.current).forEach(([key, e]) => {
      if (key.startsWith('inc-') && !activeSet.has(key.slice(4))) {
        viewer.entities.remove(e);
        delete entitiesRef.current[key];
      }
    });

    incidents.forEach(inc => {
      const key = `inc-${inc.id}`;
      if (entitiesRef.current[key]) return;

      const col = inc.severity === 'P1'
        ? new Cesium.Color(0.95, 0.1, 0.1, 0.45)
        : inc.severity === 'P2'
        ? new Cesium.Color(1, 0.5, 0.05, 0.40)
        : new Cesium.Color(0.4, 0.4, 1, 0.35);

      const img = mkCanvas(
        inc.severity === 'P1' ? '🔴' : inc.severity === 'P2' ? '🟠' : '🔵', '#00000000', 48, 48
      );

      const e = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(inc.lng, inc.lat, 60),
        cylinder: {
          length: 120, topRadius: 0, bottomRadius: 55,
          material: new Cesium.ColorMaterialProperty(col),
          outline: true,
          outlineColor: col.withAlpha(0.9),
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        billboard: {
          image: img, width: 36, height: 36,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `<b>${inc.incident_type}</b><br/>${inc.address}<br/>Severity: ${inc.severity}`,
      });
      entitiesRef.current[key] = e;
    });
  };

  const loadStaticLayers = async (Cesium, viewer) => {
    if (entitiesRef.current.loaded) return;
    entitiesRef.current.loaded = true;

    /* hospitals */
    try {
      const res = await axios.get(`${API_URL}/api/v1/medata/hospitals`);
      const hospitals = res.data?.hospitals || [];
      setStats(s => ({ ...s, hospitals: hospitals.length }));
      hospitals.forEach(h => {
        const col = h.status === 'AVAILABLE' ? '#059669' : h.status === 'BUSY' ? '#d97706' : '#dc2626';
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(h.lng, h.lat, 12),
          show: layers.hospitals,
          billboard: {
            image: mkCanvas('🏥', col),
            width: 42, height: 42,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          description: `<b>${h.name}</b><br/>Emergency: ${h.available_emergency} beds<br/>ICU: ${h.available_icu} beds`,
        });
      });
    } catch { /* silent */ }

    /* flood zones */
    try {
      const res = await axios.get(`${API_URL}/api/v1/flood/sensors`);
      const sensors = res.data?.sensors || [];
      sensors.forEach(s => {
        const r = s.alert_status === 'CRITICAL' ? 0.013 : s.alert_status === 'WARNING' ? 0.009 : 0.005;
        const a = s.alert_status === 'CRITICAL' ? 0.38  : s.alert_status === 'WARNING' ? 0.22  : 0.12;
        const color = s.alert_status === 'CRITICAL'
          ? new Cesium.Color(0.9, 0.1, 0.1, a)
          : s.alert_status === 'WARNING'
          ? new Cesium.Color(1.0, 0.6, 0.0, a)
          : new Cesium.Color(0.2, 0.5, 1.0, a);

        const pts = [];
        for (let i = 0; i <= 36; i++) {
          const ang = (i / 36) * 2 * Math.PI;
          pts.push(s.lng + r * Math.cos(ang), s.lat + r * Math.sin(ang));
        }

        viewer.entities.add({
          show: layers.flood,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(pts),
            material: new Cesium.ColorMaterialProperty(color),
            outline: true,
            outlineColor: color.withAlpha(0.85),
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          description: `<b>🌊 ${s.name}</b><br/>Level: ${s.current_level_m}m / ${s.danger_level_m}m<br/>Status: ${s.alert_status}`,
        });
      });
    } catch { /* silent */ }
  };

  const updateAqi = (viewer) => {
    const val = 70 + Math.round(Math.sin(Date.now() / 60000) * 35);
    setAqi(val);
    if (!layers.aqiFog) return;
    const cfg = AQI_FOG_MAP.find(f => val <= f.max) || AQI_FOG_MAP.at(-1);
    viewer.scene.fog.density = cfg.density;
  };

  const reset3dView = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(INDORE.lon, INDORE.lat, 600),
      orientation: {
        heading: Cesium.Math.toRadians(20),
        pitch:   Cesium.Math.toRadians(-28),
        roll:    0,
      },
      duration: 1.8,
    });
  };

  const topDownView = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(INDORE.lon, INDORE.lat, 5500),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-90),
        roll:    0,
      },
      duration: 1.5,
    });
  };


  /* ── helpers ── */
  const toggle = key => setLayers(l => ({ ...l, [key]: !l[key] }));
  const aqiColor = aqi <= 50 ? 'text-emerald-400' : aqi <= 100 ? 'text-yellow-400' : aqi <= 200 ? 'text-orange-400' : 'text-red-400';
  const aqiLabel = aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 200 ? 'Poor' : 'Hazardous';

  /* ── render ── */
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#060d1f] border-b border-cyan-500/25 flex-shrink-0">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-base">🌐</div>
          <div>
            <h1 className="text-white font-black text-sm tracking-wider leading-none">NagarIQ Digital Twin</h1>
            <p className="text-cyan-400 text-[9px] font-mono tracking-widest uppercase mt-0.5">Indore · CesiumJS 3D · Live</p>
          </div>
          <span className={`ml-2 px-2 py-1 rounded-lg text-[9px] font-bold border ${
            ready ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
          }`}>{status}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>🚑 <span className="text-white font-bold">{stats.units}</span> Units</span>
          <span>🚨 <span className="text-white font-bold">{stats.incidents}</span> Incidents</span>
          <span>🏥 <span className="text-white font-bold">{stats.hospitals}</span> Hospitals</span>
          <span>💨 <span className={`font-bold ${aqiColor}`}>{aqi} ({aqiLabel})</span></span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {[
            { k: 'units',     label: '🚑 Units' },
            { k: 'hospitals', label: '🏥 Hospitals' },
            { k: 'flood',     label: '🌊 Flood' },
            { k: 'aqiFog',   label: '💨 AQI Fog' },
          ].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                layers[k]
                  ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
                  : 'bg-[#1e293b] border-[#2d3748] text-slate-500'
              }`}
            >{label}</button>
          ))}
          <div className="w-px h-5 bg-[#2d3748] mx-1" />
          <button
            onClick={reset3dView}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-indigo-500/15 border-indigo-400/40 text-indigo-300 hover:bg-indigo-500/25 transition-all"
            title="Tilt to 3D perspective view"
          >🏙️ 3D View</button>
          <button
            onClick={topDownView}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-slate-500/15 border-slate-400/30 text-slate-300 hover:bg-slate-500/25 transition-all"
            title="Switch to top-down 2D view"
          >🗺️ Top-Down</button>

          <button onClick={onClose} className="ml-2 w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/30 border border-red-500/30 text-red-400 flex items-center justify-center font-bold text-xs transition-all">✕</button>
        </div>
      </div>

      {/* Cesium mount point */}
      <div ref={containerRef} className="flex-1 w-full" />

      {/* AQI legend */}
      {layers.aqiFog && ready && (
        <div className="absolute bottom-6 left-4 bg-[#060d1f]/85 border border-cyan-500/20 rounded-xl p-3 backdrop-blur-md pointer-events-none">
          <p className="text-[9px] font-black tracking-widest text-cyan-400 uppercase mb-1.5">💨 AQI Fog</p>
          {[
            ['0-50 Good',       'bg-emerald-400'],
            ['51-100 Moderate', 'bg-yellow-400'],
            ['101-200 Poor',    'bg-orange-400'],
            ['201+ Hazardous',  'bg-red-500'],
          ].map(([l, c]) => (
            <div key={l} className="flex items-center gap-2 mb-0.5">
              <span className={`w-3 h-2 rounded-sm ${c}`} />
              <span className="text-[9px] text-slate-400">{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Loading overlay */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060d1f]/80 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-4xl">🌐</span>
            </div>
            <p className="text-cyan-400 font-black text-xl mb-1">Loading Digital Twin</p>
            <p className="text-slate-400 text-sm">{status}</p>
            {!CESIUM_TOKEN && (
              <p className="text-amber-400 text-xs mt-2 max-w-xs mx-auto">
                ⚠️ No Cesium Ion token — terrain will be flat.<br/>
                Add VITE_CESIUM_TOKEN to dispatcher-web/.env.local
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
