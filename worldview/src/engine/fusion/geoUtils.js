/**
 * Geospatial and temporal calculation utilities for Worldview Data Fusion.
 */

const EARTH_RADIUS_KM = 6371.0;

/**
 * Calculates Great-Circle distance in kilometers between two points using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0.0;

  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2.0) *
      Math.sin(dLon / 2.0);

  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Computes geographic centroid for an array of CanonicalEvents.
 *
 * @param {Array<object>} events
 * @returns {{ lat: number, lon: number }}
 */
export function calculateCentroid(events) {
  if (!events || events.length === 0) return { lat: 0, lon: 0 };

  const validPoints = events
    .filter((e) => e?.location && typeof e.location.lat === 'number' && typeof e.location.lon === 'number')
    .map((e) => e.location);

  if (validPoints.length === 0) return { lat: 0, lon: 0 };

  let totalLat = 0;
  let totalLon = 0;

  for (const pt of validPoints) {
    totalLat += pt.lat;
    totalLon += pt.lon;
  }

  return {
    lat: Number((totalLat / validPoints.length).toFixed(5)),
    lon: Number((totalLon / validPoints.length).toFixed(5)),
  };
}

/**
 * Computes bounding box for an array of CanonicalEvents.
 *
 * @param {Array<object>} events
 * @returns {{ minLat: number, maxLat: number, minLon: number, maxLon: number }|null}
 */
export function calculateBoundingBox(events) {
  const validPoints = events
    .filter((e) => e?.location && typeof e.location.lat === 'number' && typeof e.location.lon === 'number')
    .map((e) => e.location);

  if (validPoints.length === 0) return null;

  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;

  for (const pt of validPoints) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lon < minLon) minLon = pt.lon;
    if (pt.lon > maxLon) maxLon = pt.lon;
  }

  return {
    minLat: Number(minLat.toFixed(5)),
    maxLat: Number(maxLat.toFixed(5)),
    minLon: Number(minLon.toFixed(5)),
    maxLon: Number(maxLon.toFixed(5)),
  };
}

/**
 * Temporal difference in minutes between two ISO timestamps.
 *
 * @param {string} time1
 * @param {string} time2
 * @returns {number} Absolute difference in minutes
 */
export function temporalDiffMinutes(time1, time2) {
  const t1 = new Date(time1).getTime();
  const t2 = new Date(time2).getTime();
  if (isNaN(t1) || isNaN(t2)) return Infinity;
  return Math.abs(t1 - t2) / (1000 * 60);
}
