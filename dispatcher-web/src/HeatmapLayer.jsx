import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function HeatmapLayer({ points }) {
  const map = useMap();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Set L globally so leaflet.heat can hook into it
    window.L = L;
    
    import('leaflet.heat')
      .then(() => {
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load leaflet.heat:", err);
      });
  }, []);

  useEffect(() => {
    if (!loaded || !map || !points || points.length === 0) return;

    if (typeof L.heatLayer !== 'function') {
      console.error("L.heatLayer is not defined on L");
      return;
    }

    // Create a defined "closed shape" heatmap by using a higher radius, low blur, and solid minOpacity
    const heatLayer = L.heatLayer(points, {
      radius: 95,
      blur: 25,
      max: 1.0,
      minOpacity: 0.25, // Sharp cut-off at the edges to look like a closed shape
      gradient: {
        0.1: 'rgba(244, 114, 182, 0.25)',  // Low Heat: Light Pink
        0.3: 'rgba(249, 115, 22, 0.55)',   // Low-Medium: Light Orange
        0.6: 'rgba(219, 39, 119, 0.75)',   // Medium-High: Magenta
        0.8: 'rgba(147, 51, 234, 0.90)',   // High Heat: Purple
        1.0: 'rgba(76, 29, 149, 1.0)'      // Critical Heat: Deep Dark Purple
      }
    });

    heatLayer.addTo(map);

    return () => {
      if (map && heatLayer) {
        map.removeLayer(heatLayer);
      }
    };
  }, [loaded, map, points]);

  return null;
}
