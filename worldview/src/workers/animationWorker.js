import * as satellite from 'satellite.js';

// WGS84 Ellipsoid constants
const a = 6378137.0;
const b = 6356752.3142451793;
const e2 = 1.0 - (b * b) / (a * a);

function toCartesian3(latDeg, lonDeg, altMeters) {
  const lat = latDeg * Math.PI / 180;
  const lon = lonDeg * Math.PI / 180;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon);
  const sinLon = Math.sin(lon);
  
  const N = a / Math.sqrt(1.0 - e2 * sinLat * sinLat);
  
  const x = (N + altMeters) * cosLat * cosLon;
  const y = (N + altMeters) * cosLat * sinLon;
  const z = (N * (1.0 - e2) + altMeters) * sinLat;
  
  return { x, y, z };
}

let flights = [];
let sats = [];
let isRunning = false;
let lastTime = Date.now();
let intervalId = null;

function calculatePositions() {
  const nowTime = Date.now();
  const dt = (nowTime - lastTime) / 1000.0;
  lastTime = nowTime;
  const now = new Date(nowTime);
  const gmst = satellite.gstime(now);

  const totalLength = flights.length + sats.length;
  if (totalLength === 0) return;

  // Packed format: [x, y, z, drLat, drLon] per entity
  // drLat and drLon are sent back so the main thread can update the tracked entity's live coordinates.
  const buffer = new Float64Array(totalLength * 5);
  let offset = 0;

  // Process Flights
  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    if (f.speed > 0 && f.heading !== undefined) {
      const speed_ms = f.speed * 0.514444; 
      const dist = speed_ms * dt;
      if (dist > 0) {
        const hdgRad = f.heading * Math.PI / 180;
        const latRad = f.lat * Math.PI / 180;
        const rEarth = 6378137.0;
        const dLat = (dist * Math.cos(hdgRad)) / rEarth;
        const cosLat = Math.max(Math.abs(Math.cos(latRad)), 0.0001);
        const dLon = (dist * Math.sin(hdgRad)) / (rEarth * cosLat);
        
        f.lat += dLat * 180 / Math.PI;
        f.lon += dLon * 180 / Math.PI;
      }
    }
    const { x, y, z } = toCartesian3(f.lat, f.lon, f.alt);
    buffer[offset++] = x;
    buffer[offset++] = y;
    buffer[offset++] = z;
    buffer[offset++] = f.lat;
    buffer[offset++] = f.lon;
  }

  // Process Satellites
  for (let i = 0; i < sats.length; i++) {
    const s = sats[i];
    let x = 0, y = 0, z = 0, lat = 0, lon = 0;
    try {
      const posVel = satellite.propagate(s.satrec, now);
      if (posVel.position && typeof posVel.position === 'object') {
        const geo = satellite.eciToGeodetic(posVel.position, gmst);
        lat = satellite.degreesLat(geo.latitude);
        lon = satellite.degreesLong(geo.longitude);
        const alt = geo.height * 1000;
        const cart = toCartesian3(lat, lon, alt);
        x = cart.x; y = cart.y; z = cart.z;
      }
    } catch {
      // Keep zeros on error
    }
    buffer[offset++] = x;
    buffer[offset++] = y;
    buffer[offset++] = z;
    buffer[offset++] = lat;
    buffer[offset++] = lon;
  }

  self.postMessage({ type: 'POSITIONS_FRAME', buffer }, [buffer.buffer]);
}

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'SYNC_FLIGHTS') {
    // Clone array and initialize dead reckoning coords
    flights = payload.map(f => ({
      id: f.id,
      lat: f.lat,
      lon: f.lon,
      alt: Math.max(f.altitude || 1000, 1000),
      heading: f.heading,
      speed: f.velocity || 0
    }));
    syncIds();
  } 
  else if (type === 'SYNC_SATS') {
    sats = [];
    payload.forEach(s => {
      try {
        const satrec = satellite.twoline2satrec(s.tle1, s.tle2);
        sats.push({ id: s.name, satrec });
      } catch {
        // Skip invalid
      }
    });
    syncIds();
  }
  else if (type === 'START') {
    if (!isRunning) {
      lastTime = Date.now();
      intervalId = setInterval(calculatePositions, 33); // ~30fps
      isRunning = true;
    }
  }
  else if (type === 'STOP') {
    if (isRunning) {
      clearInterval(intervalId);
      isRunning = false;
    }
  }
};

function syncIds() {
  const flightIds = flights.map(f => f.id);
  const satIds = sats.map(s => s.id);
  self.postMessage({ type: 'SYNC_IDS', flightIds, satIds });
}
