// Centralized API and WebSocket Configuration for NagarIQ Dispatcher
// Automatically switches between Local Development and Production (Vercel -> Render)

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
// Strip any trailing slash for consistency
export const API_URL = rawApiUrl.replace(/\/+$/, '');

// WebSocket URL: Render supports wss:// directly over HTTPS
function getWsUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL.replace(/\/+$/, '');
  }
  if (API_URL.startsWith('https://')) {
    return API_URL.replace(/^https:\/\//, 'wss://');
  }
  if (API_URL.startsWith('http://')) {
    return API_URL.replace(/^http:\/\//, 'ws://');
  }
  // Fallback
  return window.location.protocol === 'https:'
    ? `wss://${window.location.host}`
    : 'ws://127.0.0.1:8000';
}

export const WS_URL = getWsUrl();
