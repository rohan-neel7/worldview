import * as satellite from 'satellite.js';

let tleCache = [];

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'UPDATE_TLE') {
    const { text, cap } = payload;
    const lines = text.trim().split('\n');
    const sats = [];

    for (let i = 0; i + 2 < lines.length && sats.length < cap; i += 3) {
      const name = lines[i].trim();
      const tleLine1 = lines[i + 1].trim();
      const tleLine2 = lines[i + 2].trim();
      try {
        const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
        sats.push({ name, satrec, tle1: tleLine1, tle2: tleLine2 });
      } catch {
        // Skip invalid TLE
      }
    }
    
    tleCache = sats;
    self.postMessage({ type: 'TLE_UPDATED', count: tleCache.length });
  } 
  else if (type === 'PROPAGATE') {
    const now = new Date(payload.time);
    
    const positions = tleCache.map((sat) => {
      try {
        const posVel = satellite.propagate(sat.satrec, now);
        
        if (
          !posVel.position ||
          posVel.position === false ||
          typeof posVel.position !== 'object'
        ) {
          return null;
        }

        const gmst = satellite.gstime(now);
        const geo = satellite.eciToGeodetic(posVel.position, gmst);

        return {
          name: sat.name,
          lat: satellite.degreesLat(geo.latitude),
          lon: satellite.degreesLong(geo.longitude),
          alt: geo.height, // km
          tle1: sat.tle1,
          tle2: sat.tle2,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    self.postMessage({ type: 'POSITIONS_COMPUTED', positions });
  }
};
